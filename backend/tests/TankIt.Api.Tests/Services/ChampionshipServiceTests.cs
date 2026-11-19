using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using TankIt.Api.Models;
using TankIt.Api.Services;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Services;

public class ChampionshipServiceTests
{
    private const string RoomId = HubFixture.DefaultRoomId;

    private static async Task<(ChampionshipService Service, Championship Championship)> NewChampionshipWithMatch(
        HubFixture fixture,
        params string[] colors)
    {
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        foreach (var color in colors)
            championship.Participants.Add(new ChampionshipParticipant
            {
                ChampionshipId = championship.Id,
                TankColor = color,
            });

        await fixture.Championships.PersistAsync(championship);
        Assert.True(fixture.Championships.TryStartNextMatch(championship.Id, out _));
        await fixture.Championships.PersistAsync(championship);

        return (fixture.Championships, championship);
    }

    [Fact]
    public async Task GetOrCreateByRoomId_PersistsChampionshipAndParticipants()
    {
        var fixture = new HubFixture();

        var (championship, created) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        Assert.True(created);

        championship.Participants.Add(new ChampionshipParticipant
        {
            ChampionshipId = championship.Id,
            TankColor = "blue",
        });
        await fixture.Championships.PersistAsync(championship);

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships
            .Include(c => c.Participants)
            .SingleAsync(c => c.Id == championship.Id);

        Assert.Equal(RoomId, stored.RoomId);
        Assert.Equal(1, stored.PlayerCount); // current seats, not the DB's old 2-seat floor
        Assert.Equal("blue", Assert.Single(stored.Participants).TankColor);
    }

    [Fact]
    public async Task PersistAsync_TracksCurrentPlayerCountAndTargetScore()
    {
        var fixture = new HubFixture();
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        foreach (var color in new[] { "blue", "green", "red" })
        {
            championship.Participants.Add(new ChampionshipParticipant
            {
                Id = Guid.NewGuid(),
                ChampionshipId = championship.Id,
                TankColor = color,
            });
        }

        await fixture.Championships.PersistAsync(championship);

        await using (var db = fixture.NewDbContext())
        {
            var stored = await db.Championships.SingleAsync(c => c.Id == championship.Id);
            Assert.Equal(3, stored.PlayerCount);
        }

        Assert.True(fixture.Championships.TryStartNextMatch(championship.Id, out _));
        await fixture.Championships.PersistAsync(championship);

        await using (var db = fixture.NewDbContext())
        {
            var stored = await db.Championships.SingleAsync(c => c.Id == championship.Id);
            Assert.Equal(3, stored.PlayerCount);
            Assert.Equal(7, stored.TargetScore);
            Assert.Equal(7, stored.Ft);
        }
    }

    [Fact]
    public async Task TryStartNextMatch_PersistsMatchAndItsParticipants()
    {
        var fixture = new HubFixture();
        var (_, championship) = await NewChampionshipWithMatch(fixture, "blue", "green");

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships
            .Include(c => c.Matches)
                .ThenInclude(m => m.Participants)
            .SingleAsync(c => c.Id == championship.Id);

        var match = Assert.Single(stored.Matches);
        Assert.Equal((short?)1, match.SequenceNumber);
        Assert.Equal(MatchStatus.InProgress, match.Status);
        Assert.Equal(2, match.Participants.Count);
    }

    [Fact]
    public async Task PersistAsync_UpdatesMatchResultsAndStandings()
    {
        var fixture = new HubFixture();
        var (_, championship) = await NewChampionshipWithMatch(fixture, "blue", "green");

        var match = await fixture.Championships.GetLastMatchAsync(championship.Id);
        Assert.NotNull(match);
        match!.Status = MatchStatus.Completed;
        match.EndedAt = DateTimeOffset.UtcNow;

        var winner = match.Participants.Single(p => p.TankColor == "green");
        winner.Placement = 1;
        winner.Points = 2;
        winner.IsMatchWinner = true;
        match.WinnerId = winner.Id;

        var champWinner = championship.Participants.Single(p => p.TankColor == "green");
        champWinner.Points = 2;

        await fixture.Championships.PersistAsync(championship);

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships
            .Include(c => c.Matches)
                .ThenInclude(m => m.Participants)
            .Include(c => c.Participants)
            .SingleAsync(c => c.Id == championship.Id);

        var storedMatch = Assert.Single(stored.Matches);
        Assert.Equal(MatchStatus.Completed, storedMatch.Status);
        Assert.Null(storedMatch.WinnerId); // anonymous seat -> no user FK

        var storedWinner = storedMatch.Participants.Single(p => p.TankColor == "green");
        Assert.True(storedWinner.IsMatchWinner);
        Assert.Equal((short)1, storedWinner.Placement);
        Assert.Equal((short)2, storedWinner.Points);

        Assert.Equal((short)2, stored.Participants.Single(p => p.TankColor == "green").Points);
    }

    [Fact]
    public async Task GetOrCreateByRoomId_RestoresSeriesAfterRestart()
    {
        var fixture = new HubFixture();

        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        championship.Participants.Add(new ChampionshipParticipant
        {
            ChampionshipId = championship.Id,
            TankColor = "blue",
        });
        await fixture.Championships.PersistAsync(championship);

        // Simulate a backend restart: fresh in-memory cache, same database.
        var restarted = new ChampionshipService(
            NullLogger<ChampionshipService>.Instance,
            fixture.Services.GetRequiredService<IServiceScopeFactory>());
        var restored = await restarted.GetByRoomIdAsync(RoomId);

        Assert.NotNull(restored);
        Assert.Equal(championship.Id, restored!.Id);
        Assert.Single(restored.Participants);
    }

    [Fact]
    public async Task GetLastMatchAsync_LoadsLastMatchFromDatabaseAfterRestart()
    {
        var fixture = new HubFixture();
        var (_, championship) = await NewChampionshipWithMatch(fixture, "blue", "green");

        // Simulate a backend restart: fresh in-memory cache, same database.
        var restarted = new ChampionshipService(
            NullLogger<ChampionshipService>.Instance,
            fixture.Services.GetRequiredService<IServiceScopeFactory>());
        var match = await restarted.GetLastMatchAsync(championship.Id);

        Assert.NotNull(match);
        Assert.Equal((short?)1, match!.SequenceNumber);
        Assert.Equal(2, match.Participants.Count);
    }

    [Fact]
    public async Task CompleteAndEvictAsync_SoftDeletesAndDropsHotState()
    {
        var fixture = new HubFixture();
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);

        await fixture.Championships.CompleteAndEvictAsync(RoomId);

        Assert.False(fixture.Championships.TryGetByRoomId(RoomId, out _));

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships.SingleAsync(c => c.Id == championship.Id);
        Assert.Equal(ChampionshipStatus.Completed, stored.Status);
        Assert.NotNull(stored.CompletedAt);

        // A completed series is not reused: the next join starts a new one.
        var (next, created) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        Assert.True(created);
        Assert.NotEqual(championship.Id, next.Id);
    }

    [Fact]
    public async Task TryRemoveParticipantAsync_RemovesSeatFromDatabase()
    {
        var fixture = new HubFixture();
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync(RoomId);
        championship.Participants.Add(new ChampionshipParticipant
        {
            ChampionshipId = championship.Id,
            TankColor = "blue",
        });
        await fixture.Championships.PersistAsync(championship);

        Assert.True(await fixture.Championships.TryRemoveParticipantAsync(championship.Id, "blue"));

        await using var db = fixture.NewDbContext();
        Assert.Empty(await db.ChampionshipParticipants
            .Where(p => p.ChampionshipId == championship.Id)
            .ToListAsync());
    }
}
