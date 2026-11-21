using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TankIt.Api.Models;
using TankIt.Api.Services;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Services;

/// <summary>
/// Unit tests for the in-memory lobby bookkeeping behind GameHub
/// (backend/src/TankIt.Api/Services/RoomService.cs).
/// </summary>
public class RoomServiceTests
{
    private readonly RoomService _rooms = NewRoomService();

    [Fact]
    public void TrackJoin_AddsPlayerToRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");

        var player = Assert.Single(_rooms.GetRoomPlayers("room-1"));
        Assert.Equal("conn-a", player.ConnectionId);
        Assert.Equal("blue", player.Color);
        Assert.Equal(new[] { "room-1" },
            _rooms.GetRoomIdsForConnection("conn-a"));
    }

    [Fact]
    public void TrackJoin_KeepsEveryPlayerInTheRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-1", "conn-b", "green");
        _rooms.TrackJoin("room-2", "conn-c", "red");

        Assert.Equal(2, _rooms.GetRoomPlayers("room-1").Length);
        Assert.Contains(_rooms.GetRoomPlayers("room-1"),
            p => p.ConnectionId == "conn-b" && p.Color == "green");
        Assert.Single(_rooms.GetRoomPlayers("room-2"));
        Assert.Equal(new[] { "room-1" },
            _rooms.GetRoomIdsForConnection("conn-a"));
        Assert.Equal(new[] { "room-2" },
            _rooms.GetRoomIdsForConnection("conn-c"));
    }

    [Fact]
    public void TrackJoin_DoesNotDuplicateSameConnection()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-1", "conn-a", "blue");

        Assert.Single(_rooms.GetRoomPlayers("room-1"));
    }

    [Fact]
    public void TrackJoin_RejoiningWithAnotherColor_UpdatesThePlayer()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-1", "conn-a", "red");

        var player = Assert.Single(_rooms.GetRoomPlayers("room-1"));
        Assert.Equal("red", player.Color);
    }

    [Fact]
    public async Task TrackLeave_RemovesPlayerAndEvictsEmptyRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");

        await _rooms.TrackLeave("room-1", "conn-a");

        Assert.Empty(_rooms.GetRoomPlayers("room-1"));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
        Assert.Empty(_rooms.GetRoomIdsForConnection("conn-a"));
    }

    [Fact]
    public async Task TrackLeave_RemovesPlayerAndEvictsTheEmptyRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackRoomCreation("room-1");
        _rooms.GetOrCreateBarrels("room-1");
        Assert.NotEqual(0, _rooms.GetRoomCreatedAt("room-1"));

        await _rooms.TrackLeave("room-1", "conn-a");

        Assert.Empty(_rooms.GetRoomPlayers("room-1"));
        Assert.Empty(_rooms.GetRoomIdsForConnection("conn-a"));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
    }

    [Fact]
    public async Task TrackLeave_KeepsTheRoomAliveWhileSomeoneStays()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-1", "conn-b", "green");
        _rooms.TrackRoomCreation("room-1");

        await _rooms.TrackLeave("room-1", "conn-b");

        Assert.Single(_rooms.GetRoomPlayers("room-1"));
        Assert.NotEqual(0, _rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public async Task TrackDisconnect_LeavesEveryRoomTheConnectionWasIn()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-2", "conn-a", "green");
        _rooms.TrackJoin("room-1", "conn-b", "red");

        await _rooms.TrackDisconnect("conn-a");

        Assert.Empty(_rooms.GetRoomIdsForConnection("conn-a"));
        Assert.Single(_rooms.GetRoomPlayers("room-1"));
        Assert.Empty(_rooms.GetRoomPlayers("room-2"));
    }

    [Fact]
    public void GetRoomIdsForConnection_ReturnsEveryRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-2", "conn-a", "blue");

        var roomIds = _rooms.GetRoomIdsForConnection("conn-a");

        Assert.Equal(2, roomIds.Length);
        Assert.Contains("room-1", roomIds);
        Assert.Contains("room-2", roomIds);
    }

    [Fact]
    public void TrackRoomCreation_IsIdempotentPerRoom()
    {
        var first = _rooms.TrackRoomCreation("room-1");
        var second = _rooms.TrackRoomCreation("room-1");

        Assert.Equal(first, second);
        Assert.NotEqual(0, first);
        Assert.Equal(first, _rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public void GetOrCreateBarrels_ReusesTheSamePositionsPerRoom()
    {
        var first = _rooms.GetOrCreateBarrels("room-1");
        var again = _rooms.GetOrCreateBarrels("room-1");
        var otherRoom = _rooms.GetOrCreateBarrels("room-2");

        Assert.Same(first, again);
        Assert.NotSame(first, otherRoom);
        Assert.Equal(10, first.Length);
        Assert.Equal(10, first.Distinct().Count());
    }

    [Fact]
    public void TryGetAndRemoveBarrels_RoundTrip()
    {
        _rooms.GetOrCreateBarrels("room-1");

        Assert.True(_rooms.TryGetBarrels("room-1", out var barrels));
        Assert.NotNull(barrels);
        Assert.True(_rooms.TryRemoveBarrels("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
    }

    [Fact]
    public async Task TryEvictRoom_RemovesKnownRoomAndRejectsUnknownRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackRoomCreation("room-1");
        _rooms.GetOrCreateBarrels("room-1");

        Assert.True(await _rooms.TryEvictRoomAsync("room-1"));
        Assert.False(await _rooms.TryEvictRoomAsync("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public async Task UnknownRoom_IsHarmless()
    {
        Assert.Empty(_rooms.GetRoomPlayers("nope"));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("nope"));
        Assert.False(await _rooms.TryEvictRoomAsync("nope"));

        // Leaving a room/connection nobody ever joined must not throw.
        await _rooms.TrackLeave("nope", "ghost");
        await _rooms.TrackDisconnect("ghost");
    }

    [Fact]
    public async Task TrackLeave_KeepsRoomAndSeriesWhileMatchInProgress()
    {
        var fixture = new HubFixture();
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync("room-1", GameMode.Championship);
        championship.Participants.Add(new ChampionshipParticipant
        {
            ChampionshipId = championship.Id,
            TankColor = "blue",
        });
        await fixture.Championships.PersistAsync(championship);
        Assert.True(fixture.Championships.TryStartNextMatch(championship.Id, out _));
        await fixture.Championships.PersistAsync(championship);

        fixture.Rooms.TrackJoin("room-1", "connection-a", "blue");
        fixture.Rooms.TrackRoomCreation("room-1");
        fixture.Rooms.GetOrCreateBarrels("room-1");

        await fixture.Rooms.TrackLeave("room-1", "connection-a");

        // Room churn (lobby -> game handoff) must not wipe a live match.
        Assert.NotEqual(0, fixture.Rooms.GetRoomCreatedAt("room-1"));
        Assert.True(fixture.Rooms.TryGetBarrels("room-1", out _));
        Assert.Empty(fixture.Rooms.GetRoomPlayers("room-1"));
        Assert.True(fixture.Championships.TryGetByRoomId("room-1", out var active));
        Assert.Equal(ChampionshipStatus.InProgress, active!.Status);
    }

    [Fact]
    public async Task TryEvictRoomAsync_CompletesSeriesBeforeReturning()
    {
        var fixture = new HubFixture();
        var (championship, _) = await fixture.Championships.GetOrCreateByRoomIdAsync("room-1", GameMode.Championship);
        fixture.Rooms.TrackJoin("room-1", "connection-a", "blue");

        Assert.True(await fixture.Rooms.TryEvictRoomAsync("room-1"));

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships.SingleAsync(c => c.Id == championship.Id);
        Assert.Equal(ChampionshipStatus.Completed, stored.Status);
        Assert.NotNull(stored.CompletedAt);
        Assert.False(fixture.Championships.TryGetByRoomId("room-1", out _));
    }

    private static RoomService NewRoomService()
    {
        var deathWall = new DeathWallService(
            Moq.Mock.Of<Microsoft.AspNetCore.SignalR.IHubContext<TankIt.Api.Hubs.GameHub, TankIt.Api.Hubs.IGameClient>>(),
            NullLogger<DeathWallService>.Instance
        );
        var championships = new ChampionshipService(
            NullLogger<ChampionshipService>.Instance,
            Moq.Mock.Of<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>()
        );
        return new RoomService(new MapService(), deathWall, championships, NullLogger<RoomService>.Instance);
    }
}
