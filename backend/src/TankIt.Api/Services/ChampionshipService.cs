using System.Collections.Concurrent;
using TankIt.Api.Models;

public sealed class ChampionshipService(ILogger<ChampionshipService> logger)
{
    private readonly ConcurrentDictionary<Guid, Championship> _championships = new();
    private readonly ConcurrentDictionary<string, Guid> _roomToChampionship = new();
    private readonly ILogger<ChampionshipService> _logger = logger;

    public (Championship Championship, bool Created) GetOrCreate(Guid id)
    {
        if (_championships.TryGetValue(id, out var existing))
            return (existing, false);

        var championship = new Championship
        {
            Id = Guid.NewGuid(),
            TargetScore = 7,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (_championships.TryAdd(id, championship))
        {
            _logger.LogInformation(
        "Championship {ChampionshipId} created in memory",
            id);

            return (championship, true);
        }

        return (_championships[id], false);
    }

    public (Championship Championship, bool Created) GetOrCreateByRoomId(string roomId)
    {
        if (_roomToChampionship.TryGetValue(roomId, out var guid))
            return GetOrCreate(guid);

        var championship = new Championship
        {
            Id = Guid.NewGuid(),
            RoomId = roomId,
            TargetScore = 7,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (_championships.TryAdd(championship.Id, championship))
        {
            _roomToChampionship[roomId] = championship.Id;

            _logger.LogInformation(
                "Championship {ChampionshipId} created for room {RoomId}",
                championship.Id,
                roomId);

            return (championship, true);
        }

        return (_championships[_roomToChampionship[roomId]], false);
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
            })];

            championship.Matches.Add(newMatch);
            championship.Status = ChampionshipStatus.InProgress;
            championship.StartedAt ??= startedAt;

            _logger.LogInformation(
                "Championship {ChampionshipId} started match {MatchId} (sequence {SequenceNumber})",
                championship.Id,
                newMatch.Id,
                newMatch.SequenceNumber);

            match = newMatch;
            return true;
        }
    }

    public bool TryGetLastMatch(Guid id, out Match? match)
    {
        match = null;
        if (!_championships.TryGetValue(id, out var championship))
            return false;

        lock (championship)
        {
            match = championship.Matches
                .OrderByDescending(m => m.SequenceNumber ?? 0)
                .FirstOrDefault();
            return match is not null;
        }
    }

    public bool TryRemoveParticipant(Guid id, string tankColor)
    {
        if (!_championships.TryGetValue(id, out var championship))
            return false;

        lock (championship)
        {
            var participant = championship.Participants
                .FirstOrDefault(p => p.TankColor == tankColor);

            if (participant is null)
                return false;

            return championship.Participants.Remove(participant);
        }
    }
}
