using System.Collections.Concurrent;
using TankIt.Api.Data;
using TankIt.Api.Models;

namespace TankIt.Api.Services;

// Hot state for championships/matches lives in memory so gameplay does not hit
// the database on every SignalR message. Every mutation is written through to
// PostgreSQL (best effort: a DB outage logs and the match keeps running), and
// lookups fall back to the database so a backend restart does not lose series.
public sealed class ChampionshipService(
    ILogger<ChampionshipService> logger,
    IServiceScopeFactory scopeFactory)
{
    private readonly ConcurrentDictionary<Guid, Championship> _championships = new();
    private readonly ConcurrentDictionary<string, Guid> _roomToChampionship = new();
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _persistLocks = new();
    private readonly ILogger<ChampionshipService> _logger = logger;
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    public async Task<(Championship Championship, bool Created)> GetOrCreateByRoomIdAsync(
        string roomId,
        CancellationToken ct = default)
    {
        if (_roomToChampionship.TryGetValue(roomId, out var known)
            && _championships.TryGetValue(known, out var cached))
            return (cached, false);

        var persisted = await LoadAsync(roomId, ct);
        if (persisted is not null)
        {
            var current = _championships.GetOrAdd(persisted.Id, persisted);
            _roomToChampionship[roomId] = current.Id;

            _logger.LogInformation(
                "Championship {ChampionshipId} restored from database for room {RoomId}",
                current.Id,
                roomId);

            return (current, false);
        }

        var championship = new Championship
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            TargetScore = Championship.TargetScoreFor(0),
            Ft = Championship.TargetScoreFor(0),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _championships[championship.Id] = championship;
        _roomToChampionship[roomId] = championship.Id;

        _logger.LogInformation(
            "Championship {ChampionshipId} created for room {RoomId}",
            championship.Id,
            roomId);

        await PersistAsync(championship, ct);
        return (championship, true);
    }

    public async Task<Championship?> GetAsync(Guid id, CancellationToken ct = default)
    {
        if (_championships.TryGetValue(id, out var cached))
            return cached;

        var persisted = await LoadAsync(id, ct);
        return persisted is null ? null : _championships.GetOrAdd(persisted.Id, persisted);
    }

    public async Task<Championship?> GetByRoomIdAsync(string roomId, CancellationToken ct = default)
    {
        if (_roomToChampionship.TryGetValue(roomId, out var known)
            && _championships.TryGetValue(known, out var cached))
            return cached;

        var persisted = await LoadAsync(roomId, ct);
        if (persisted is null)
            return null;

        var current = _championships.GetOrAdd(persisted.Id, persisted);
        _roomToChampionship[roomId] = current.Id;
        return current;
    }

    public bool TryGet(Guid id, out Championship? championship)
        => _championships.TryGetValue(id, out championship);

    public bool TryGetByRoomId(string roomId, out Championship? championship)
    {
        championship = null;
        return _roomToChampionship.TryGetValue(roomId, out var guid)
            && _championships.TryGetValue(guid, out championship);
    }

    public bool TryStartNextMatch(Guid id, out Match? match)
    {
        match = null;

        if (!_championships.TryGetValue(id, out var championship))
            return false;

        lock (championship)
        {
            if (championship.Matches.Count == 0)
            {
                championship.TargetScore = Championship.TargetScoreFor(championship.Participants.Count);
                championship.Ft = championship.TargetScore;
            }

            var nextSequence = (short)(championship.Matches.Count == 0
                ? 1
                : championship.Matches.Max(m => m.SequenceNumber ?? 0) + 1);

            var startedAt = DateTimeOffset.UtcNow;

            var newMatch = new Match
            {
                Id = Guid.NewGuid(),
                Status = MatchStatus.InProgress,
                ChampionshipId = championship.Id,
                Championship = championship,
                SequenceNumber = nextSequence,
                PlayerCount = (short)championship.Participants.Count,
                StartedAt = startedAt,
            };

            newMatch.Participants = [.. championship.Participants.Select(cp => new MatchParticipant
            {
                Id = Guid.NewGuid(),
                MatchId = newMatch.Id,
                Match = newMatch,
                UserId = cp.UserId,
                IsAi = cp.IsAi,
                TankColor = cp.TankColor,
                IsDone = false
            })];

            championship.Matches.Add(newMatch);
            championship.Status = ChampionshipStatus.InProgress;
            championship.StartedAt ??= startedAt;
            match = newMatch;
            return true;
        }
    }

    public async Task<Match?> GetLastMatchAsync(Guid id, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ChampionshipRepository>();
        var persisted = await repository.GetLastMatchAsync(id, ct);
        if (persisted is null)
            return null;

        // Return the live in-memory instance when present so callers can mutate
        // it and still persist through PersistAsync(championship).
        var championship = await GetAsync(id, ct);
        if (championship is null)
            return persisted;

        lock (championship)
            return championship.Matches.FirstOrDefault(m => m.Id == persisted.Id) ?? persisted;
    }

    public async Task<bool> TryRemoveParticipantAsync(Guid id, string tankColor, CancellationToken ct = default)
    {
        if (!_championships.TryGetValue(id, out var championship))
            return false;

        bool removed = false;
        lock (championship)
        {
            var participants = championship.Participants
                .Where(p => p.TankColor == tankColor)
                .ToList();

            foreach (var participant in participants)
                removed |= championship.Participants.Remove(participant);
        }

        if (removed)
            await PersistAsync(championship, ct);

        return removed;
    }

    public async Task PersistAsync(Championship championship, CancellationToken ct = default)
    {
        // Serialize writes per championship: concurrent SignalR messages would
        // otherwise race and try to insert the same child row twice.
        var gate = _persistLocks.GetOrAdd(championship.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ChampionshipRepository>();
            await repository.SaveAsync(championship, ct);
        }
        catch (Exception ex)
        {
            // Persistence is write-through but not on the gameplay critical path:
            // log and keep playing instead of dropping the match on a DB hiccup.
            _logger.LogError(ex,
                "Failed to persist championship {ChampionshipId} for room {RoomId}",
                championship.Id,
                championship.RoomId);
        }
        finally
        {
            gate.Release();
        }
    }

    // Soft delete: the series stays in the database for history; only the hot
    // in-memory state is dropped so the next join in the same room starts fresh.
    public async Task CompleteAndEvictAsync(string roomId, CancellationToken ct = default)
    {
        if (!_roomToChampionship.TryGetValue(roomId, out var id)
            || !_championships.TryGetValue(id, out var championship))
            return;

        championship.Status = ChampionshipStatus.Completed;
        championship.CompletedAt ??= DateTimeOffset.UtcNow;

        await PersistAsync(championship, ct);

        _championships.TryRemove(id, out _);
        _roomToChampionship.TryRemove(roomId, out _);
        _persistLocks.TryRemove(id, out _);
    }

    private async Task<Championship?> LoadAsync(Guid id, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ChampionshipRepository>();
            return await repository.GetByIdAsync(id, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load championship {ChampionshipId} from database", id);
            return null;
        }
    }

    private async Task<Championship?> LoadAsync(string roomId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ChampionshipRepository>();
            return await repository.GetActiveByRoomIdAsync(roomId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load championship for room {RoomId} from database", roomId);
            return null;
        }
    }
}
