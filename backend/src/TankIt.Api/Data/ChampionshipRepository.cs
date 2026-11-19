using Microsoft.EntityFrameworkCore;
using TankIt.Api.Models;

namespace TankIt.Api.Data;

// Write-through persistence for the in-memory championship aggregate.
// ChampionshipService keeps the hot game state in memory (reads stay allocation
// free and don't hit the DB); this repository copies the current state of that
// aggregate into a scoped AppDbContext whenever the hub mutates it.
public sealed class ChampionshipRepository(AppDbContext db)
{
    private readonly AppDbContext _db = db;

    public Task<Championship?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Aggregate().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<Championship?> GetActiveByRoomIdAsync(string roomId, CancellationToken ct = default)
        => Aggregate()
            .Where(c => c.RoomId == roomId && c.Status != ChampionshipStatus.Completed)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public Task<Match?> GetLastMatchAsync(Guid championshipId, CancellationToken ct = default)
        => _db.Matches
            .Include(m => m.Participants)
            .Where(m => m.ChampionshipId == championshipId)
            .OrderByDescending(m => m.SequenceNumber ?? 0)
            .FirstOrDefaultAsync(ct);

    private IQueryable<Championship> Aggregate()
        => _db.Championships
            .Include(c => c.Participants)
            .Include(c => c.Matches)
                .ThenInclude(m => m.Participants);

    public async Task SaveAsync(Championship championship, CancellationToken ct = default)
    {
        var target = await _db.Championships
            .Include(c => c.Participants)
            .Include(c => c.Matches)
                .ThenInclude(m => m.Participants)
            .FirstOrDefaultAsync(c => c.Id == championship.Id, ct);

        if (target is null)
        {
            target = new Championship { Id = championship.Id, CreatedAt = championship.CreatedAt };
            _db.Championships.Add(target);
        }

        CopyChampionship(championship, target);
        SyncChampionshipParticipants(championship, target);
        SyncMatches(championship, target);

        await _db.SaveChangesAsync(ct);
    }

    private static void CopyChampionship(Championship src, Championship dst)
    {
        dst.RoomId = src.RoomId;
        dst.Status = src.Status;
        // The DB enforces a 1..4 seat count; clamp so a stale/in-memory roster
        // can never write an out-of-range value.
        dst.PlayerCount = ClampPlayerCount(src.Participants.Count);
        dst.TargetScore = src.TargetScore > 0
            ? src.TargetScore
            : Championship.TargetScoreFor(src.Participants.Count);
        dst.WinnerId = ResolveUserId(src.Participants, src.WinnerId);
        dst.CreatedBy = src.CreatedBy;
        dst.Ft = src.Ft > 0 ? src.Ft : dst.TargetScore;
        dst.StartedAt = src.StartedAt;
        dst.CompletedAt = src.CompletedAt;
    }

    private void SyncChampionshipParticipants(Championship src, Championship dst)
    {
        var matched = new HashSet<Guid>();

        foreach (var sp in src.Participants)
        {
            var dp = sp.Id != Guid.Empty
                ? dst.Participants.FirstOrDefault(p => p.Id == sp.Id)
                : null;

            // Fallback: color is the stable player identity in this domain. This
            // avoids collapsing seats when an in-memory participant has no id yet.
            dp ??= dst.Participants.FirstOrDefault(p => p.TankColor == sp.TankColor);

            if (dp is null)
            {
                dp = new ChampionshipParticipant
                {
                    Id = sp.Id != Guid.Empty ? sp.Id : Guid.NewGuid(),
                    ChampionshipId = dst.Id,
                    TankColor = sp.TankColor,
                };
                dst.Participants.Add(dp);
                _db.ChampionshipParticipants.Add(dp);
            }

            sp.Id = dp.Id; // keep in-memory identity stable for the next save
            dp.UserId = sp.UserId;
            dp.IsAi = sp.IsAi;
            dp.TankColor = sp.TankColor;
            dp.Placement = sp.Placement;
            dp.Points = sp.Points;
            dp.CreatedAt = sp.CreatedAt;
            matched.Add(dp.Id);
        }

        foreach (var removed in dst.Participants
                     .Where(dp => !matched.Contains(dp.Id))
                     .ToArray())
        {
            _db.ChampionshipParticipants.Remove(removed);
        }
    }

    private void SyncMatches(Championship src, Championship dst)
    {
        foreach (var sm in src.Matches)
        {
            var dm = dst.Matches.FirstOrDefault(m => m.Id == sm.Id);
            if (dm is null)
            {
                dm = new Match { Id = sm.Id, ChampionshipId = dst.Id, CreatedAt = sm.CreatedAt };
                dst.Matches.Add(dm);
                _db.Matches.Add(dm);
            }

            dm.Status = sm.Status;
            dm.MapSeed = sm.MapSeed;
            dm.IsRanked = sm.IsRanked;
            dm.PlayerCount = ClampPlayerCount(sm.Participants.Count);
            dm.WinnerId = ResolveUserId(sm.Participants, sm.WinnerId);
            dm.SequenceNumber = sm.SequenceNumber;
            dm.StartedAt = sm.StartedAt;
            dm.EndedAt = sm.EndedAt;

            SyncMatchParticipants(sm, dm);
        }
    }

    private void SyncMatchParticipants(Match src, Match dst)
    {
        foreach (var removed in dst.Participants
                     .Where(dp => src.Participants.All(sp => sp.Id != dp.Id))
                     .ToArray())
        {
            _db.MatchParticipants.Remove(removed);
        }

        foreach (var sp in src.Participants)
        {
            var dp = dst.Participants.FirstOrDefault(p => p.Id == sp.Id);
            if (dp is null)
            {
                dp = new MatchParticipant
                {
                    Id = sp.Id,
                    MatchId = dst.Id,
                    TankColor = sp.TankColor,
                };
                dst.Participants.Add(dp);
                _db.MatchParticipants.Add(dp);
            }

            dp.UserId = sp.UserId;
            dp.IsAi = sp.IsAi;
            dp.IsMatchWinner = sp.IsMatchWinner;
            dp.IsChampionshipWinner = sp.IsChampionshipWinner;
            dp.TankColor = sp.TankColor;
            dp.Placement = sp.Placement;
            dp.Points = sp.Points;
            dp.ShotsFired = sp.ShotsFired;
            dp.Hits = sp.Hits;
            dp.Kills = sp.Kills;
            dp.SurvivedSeconds = sp.SurvivedSeconds;
            dp.EloDelta = sp.EloDelta;
        }
    }

    private static short ClampPlayerCount(int count) => (short)Math.Clamp(count, 1, 4);

    // In-memory winner ids point at the participant row (the game has no persisted
    // user identity yet). The DB FK points at users(id), so translate to the
    // participant's user id and fall back to null for anonymous seats.
    private static Guid? ResolveUserId(IEnumerable<ChampionshipParticipant> participants, Guid? winnerId)
    {
        if (winnerId is not Guid id)
            return null;

        var participant = participants.FirstOrDefault(p => p.Id == id);
        if (participant is not null)
            return participant.UserId;

        return participants.Any(p => p.UserId == id) ? id : null;
    }

    private static Guid? ResolveUserId(IEnumerable<MatchParticipant> participants, Guid? winnerId)
    {
        if (winnerId is not Guid id)
            return null;

        var participant = participants.FirstOrDefault(p => p.Id == id);
        if (participant is not null)
            return participant.UserId;

        return participants.Any(p => p.UserId == id) ? id : null;
    }
}
