using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Models;

namespace TankIt.Api.Services;

public sealed class MatchSettlementOptions
{
    public TimeSpan TieWindow { get; init; } = TimeSpan.FromMilliseconds(500);

    // Longer than TieWindow on purpose: a late report is still counted, but only
    // reports inside TieWindow (or sharing a wall step) share a score group.
    public TimeSpan SettlementGrace { get; init; } = TimeSpan.FromMilliseconds(1500);
}

public sealed record MatchDeathRecord(string Color, long ReceivedAt, int? WallStep);

// Deaths are reported by the victim's own client, so "simultaneous" can only be
// approximated by server receipt time. Deaths sharing a wall step are grouped
// deterministically; projectile deaths use a short receipt-time window.
public sealed class MatchSettlementService(
    ChampionshipService championships,
    DeathWallService deathWall,
    IHubContext<GameHub, IGameClient> hub,
    TimeProvider time,
    MatchSettlementOptions options,
    ILogger<MatchSettlementService> logger)
{
    private readonly ConcurrentDictionary<Guid, MatchSettlementState> _pending = new();

    private sealed class MatchSettlementState
    {
        public readonly object Gate = new();
        public readonly List<MatchDeathRecord> Deaths = [];
        public CancellationTokenSource? Timer;
        public long Version;
    }

    public void RecordDeath(Guid matchId, string color, int? wallStep)
    {
        var state = _pending.GetOrAdd(matchId, _ => new MatchSettlementState());

        lock (state.Gate)
        {
            state.Deaths.Add(new MatchDeathRecord(color, time.GetTimestamp(), wallStep));
            state.Version++;

            state.Timer?.Cancel();
            state.Timer = null;
        }
    }

    // Returns quickly for non-zero delays; awaits the settlement when the delay
    // is zero so callers/tests observe MatchEnded deterministically.
    public Task ScheduleAsync(Guid championshipId, Guid matchId, bool immediate)
    {
        var state = _pending.GetOrAdd(matchId, _ => new MatchSettlementState());

        CancellationTokenSource timer;
        long version;
        lock (state.Gate)
        {
            state.Timer?.Cancel();
            state.Timer = new CancellationTokenSource();
            timer = state.Timer;
            version = state.Version;
        }

        var delay = immediate ? TimeSpan.Zero : RemainingGrace(state);
        if (delay <= TimeSpan.Zero)
            return SettleAsync(championshipId, matchId, version);

        _ = SettleAfterDelayAsync(championshipId, matchId, version, delay, timer);
        return Task.CompletedTask;
    }

    // Used by StartMatch to make sure a previous match is not left half-finished,
    // and by tests to avoid waiting for the grace period.
    public async Task FlushAsync(Guid championshipId)
    {
        var championship = await championships.GetAsync(championshipId);
        if (championship is null)
            return;

        Guid? matchId;
        lock (championship)
        {
            var match = championship.Matches
                .OrderByDescending(m => m.SequenceNumber ?? 0)
                .FirstOrDefault();

            if (match is null || match.Status == MatchStatus.Completed)
                return;

            matchId = match.Id;
        }

        await SettleAsync(championshipId, matchId.Value, expectedVersion: null);
    }

    public bool HasPending(Guid championshipId)
    {
        if (!championships.TryGet(championshipId, out var championship)
            || championship is null)
            return false;

        Guid? matchId;
        lock (championship)
        {
            matchId = championship.Matches
                .OrderByDescending(m => m.SequenceNumber ?? 0)
                .FirstOrDefault()?.Id;
        }

        if (matchId is not Guid id
            || !_pending.TryGetValue(id, out var state))
            return false;

        lock (state.Gate)
            return state.Timer is not null;
    }

    public void Cancel(Guid championshipId)
    {
        if (!championships.TryGet(championshipId, out var championship)
            || championship is null)
            return;

        Guid? matchId;
        lock (championship)
        {
            matchId = championship.Matches
                .OrderByDescending(m => m.SequenceNumber ?? 0)
                .FirstOrDefault()?.Id;
        }

        if (matchId is Guid id)
            RemovePending(id);
    }

    private TimeSpan RemainingGrace(MatchSettlementState state)
    {
        long? lastReceivedAt;
        lock (state.Gate)
        {
            lastReceivedAt = state.Deaths.Count == 0
                ? null
                : state.Deaths.Max(d => d.ReceivedAt);
        }

        if (lastReceivedAt is not long last)
            return options.SettlementGrace;

        var remaining = options.SettlementGrace - time.GetElapsedTime(last);
        return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
    }

    private async Task SettleAfterDelayAsync(
        Guid championshipId,
        Guid matchId,
        long version,
        TimeSpan delay,
        CancellationTokenSource timer)
    {
        try
        {
            await Task.Delay(delay, time, timer.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        if (_pending.TryGetValue(matchId, out var state))
        {
            lock (state.Gate)
            {
                if (state.Timer == timer)
                    state.Timer = null;
            }
        }

        await SettleAsync(championshipId, matchId, version);
    }

    private async Task SettleAsync(Guid championshipId, Guid matchId, long? expectedVersion)
    {
        var championship = await championships.GetAsync(championshipId);
        if (championship is null)
        {
            RemovePending(matchId);
            return;
        }

        ChampionshipMatchInfoDto? result = null;

        lock (championship)
        {
            var match = championship.Matches.FirstOrDefault(m => m.Id == matchId);
            if (match is null || match.Status == MatchStatus.Completed)
            {
                RemovePending(matchId);
                return;
            }

            MatchDeathRecord[] deaths;
            if (_pending.TryGetValue(matchId, out var state))
            {
                lock (state.Gate)
                {
                    if (expectedVersion is long expected && state.Version != expected)
                        return;

                    deaths = [.. state.Deaths.OrderBy(d => d.ReceivedAt)];
                }
            }
            else
            {
                deaths = [];
            }

            var alive = match.Participants.Count(p => !p.IsDone);
            if (alive > 1)
            {
                logger.LogInformation(
                    "Match settlement deferred: match {MatchId} still has {Alive} tanks alive",
                    match.Id, alive);
                return;
            }

            result = CompleteMatch(championship, match, deaths);
        }

        try
        {
            await championships.PersistAsync(championship);
            await hub.Clients.Group(championship.RoomId).MatchEnded(result);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to broadcast end of match {MatchId} in room {RoomId}",
                matchId, championship.RoomId);
        }
        finally
        {
            deathWall.Stop(championship.RoomId);
            RemovePending(matchId);
        }
    }

    private void RemovePending(Guid matchId)
    {
        if (!_pending.TryRemove(matchId, out var state))
            return;

        lock (state.Gate)
        {
            state.Timer?.Cancel();
            state.Timer = null;
        }
    }

    private ChampionshipMatchInfoDto CompleteMatch(
        Championship championship,
        Match match,
        IReadOnlyList<MatchDeathRecord> deaths)
    {
        match.Status = MatchStatus.Completed;
        match.EndedAt = time.GetUtcNow();
        match.Deaths = (short)deaths.Count;

        foreach (var participant in match.Participants)
        {
            participant.IsMatchWinner = false;
            participant.IsChampionshipWinner = false;
        }

        ApplyDeathScores(match, deaths);

        var survivor = match.Participants.FirstOrDefault(p => !p.IsDone);
        if (survivor is not null)
        {
            survivor.Placement = 0;
            survivor.Points = (short)(match.PlayerCount - 1);
            survivor.IsMatchWinner = true;
            survivor.IsDone = true;
            match.WinnerId = survivor.Id;
        }
        else
        {
            match.WinnerId = null;
        }

        var isChampionship = championship.Mode == GameMode.Championship;

        if (isChampionship)
        {
            foreach (var matchParticipant in match.Participants)
            {
                var championshipParticipant = championship.Participants
                    .FirstOrDefault(cp => cp.TankColor == matchParticipant.TankColor);

                if (championshipParticipant is not null)
                {
                    championshipParticipant.Points = (short)(
                        (championshipParticipant.Points ?? 0)
                        + (matchParticipant.Points ?? 0));
                }
            }

            var winners = championship.Participants
                .Where(cp => (cp.Points ?? 0) >= championship.Ft)
                .ToArray();

            if (winners.Length > 0)
            {
                var maxPoints = winners.Max(w => w.Points ?? 0);
                var leaders = winners
                    .Where(w => (w.Points ?? 0) == maxPoints)
                    .ToArray();

                if (leaders.Length > 1)
                {
                    logger.LogWarning(
                        "Tie detected among championship leaders at {Points} points ({Colors}). Championship continues.",
                        maxPoints,
                        string.Join(", ", leaders.Select(w => w.TankColor)));
                }
                else
                {
                    var champion = leaders[0];
                    championship.WinnerId = champion.Id;
                    championship.WinnerColor = champion.TankColor;
                    championship.Status = ChampionshipStatus.Completed;
                    championship.CompletedAt = time.GetUtcNow();
                }
            }
        }

        string[] displayNames = [
            "asdrubal",
            "gertrudes",
            "cremilda",
            "robisberto"
        ];
        var index = 0;

        var tanksScore = match.Participants
            .Select(p => new TankScoreInfo
            {
                Label = p.IsAi ? "AI" : p.User?.DisplayName ?? p.TankColor,
                User = displayNames[index++],
                Color = p.TankColor,
                Score = isChampionship
                    ? championship.Participants
                        .FirstOrDefault(pa => pa.TankColor == p.TankColor)?.Points
                    : p.Points,
                Placement = p.Placement,
                IsMatchWinner = p.IsMatchWinner,
                IsChampionshipWinner =
                    isChampionship && championship.WinnerColor == p.TankColor
            }).ToArray();

        return new ChampionshipMatchInfoDto
        {
            RoomId = championship.RoomId,
            Ft = isChampionship
                ? championship.Ft
                : (short)Math.Max(1, match.PlayerCount - 1),
            Mode = championship.Mode.ToWireValue(),
            ChampionshipId = championship.Id,
            MatchId = match.Id,
            ChampionshipStatus = championship.Status,
            MatchWinnerId = match.WinnerId,
            ChampionshipWinnerId = championship.WinnerId,
            TanksScore = tanksScore
        };
    }

    private void ApplyDeathScores(Match match, IReadOnlyList<MatchDeathRecord> deaths)
    {
        if (deaths.Count == 0)
            return;

        var ordered = deaths.OrderBy(d => d.ReceivedAt).ToArray();

        for (var i = 0; i < ordered.Length;)
        {
            var j = i + 1;
            while (j < ordered.Length && SameDeathEvent(ordered[i], ordered[j]))
                j++;

            // Shared-best: the whole group gets the score of the last death in
            // the group. Three players, first two tie -> 1 point and placement 1
            // for both; the survivor gets 2 points and placement 0.
            var points = (short)(j - 1);
            var placement = (short)(match.PlayerCount - j);

            for (var k = i; k < j; k++)
            {
                var participant = match.Participants
                    .FirstOrDefault(p => p.TankColor == ordered[k].Color);

                if (participant is null)
                {
                    logger.LogWarning(
                        "Death record for {Color} in match {MatchId} has no participant",
                        ordered[k].Color, match.Id);
                    continue;
                }

                participant.Points = points;
                participant.Placement = placement;
                participant.IsDone = true;
                participant.IsMatchWinner = false;
            }

            logger.LogInformation(
                "Match {MatchId} death group ({Colors}) -> placement {Placement}, points {Points}, wallStep {WallStep}",
                match.Id,
                string.Join(", ", ordered[i..j].Select(d => d.Color)),
                placement,
                points,
                ordered[i].WallStep);

            i = j;
        }
    }

    private bool SameDeathEvent(MatchDeathRecord first, MatchDeathRecord current)
    {
        if (first.WallStep is int firstStep
            && current.WallStep is int currentStep)
            return firstStep == currentStep;

        return time.GetElapsedTime(first.ReceivedAt, current.ReceivedAt)
            <= options.TieWindow;
    }
}
