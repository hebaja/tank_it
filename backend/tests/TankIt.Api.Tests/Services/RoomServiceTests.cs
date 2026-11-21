using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TankIt.Api.Models;
using TankIt.Api.Services;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Services;

public sealed class RoomServiceTests
{
    [Fact]
    public void TrackJoin_AddsPlayerToRoom()
    {
        var rooms = NewRoomService();

        rooms.TrackJoin("room-1", "connection-a", "blue");

        var player = Assert.Single(rooms.GetRoomPlayers("room-1"));
        Assert.Equal("connection-a", player.ConnectionId);
        Assert.Equal("blue", player.Color);
    }

    [Fact]
    public void TrackJoin_DoesNotDuplicateSameConnection()
    {
        var rooms = NewRoomService();

        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-1", "connection-a", "blue");

        Assert.Single(rooms.GetRoomPlayers("room-1"));
    }

    [Fact]
    public async Task TrackLeave_RemovesPlayerAndEvictsEmptyRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackRoomCreation("room-1");
        rooms.GetOrCreateBarrels("room-1");

        await rooms.TrackLeave("room-1", "connection-a");

        Assert.Empty(rooms.GetRoomPlayers("room-1"));
        Assert.Equal(0, rooms.GetRoomCreatedAt("room-1"));
        Assert.False(rooms.TryGetBarrels("room-1", out _));
        Assert.Empty(rooms.GetRoomIdsForConnection("connection-a"));
    }

    [Fact]
    public async Task TrackLeave_KeepsRoomWhilePlayersRemain()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-1", "connection-b", "red");

        await rooms.TrackLeave("room-1", "connection-a");

        var player = Assert.Single(rooms.GetRoomPlayers("room-1"));
        Assert.Equal("connection-b", player.ConnectionId);
    }

    [Fact]
    public async Task TrackDisconnect_RemovesConnectionFromEveryRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-2", "connection-a", "blue");
        rooms.TrackJoin("room-2", "connection-b", "red");

        await rooms.TrackDisconnect("connection-a");

        Assert.Empty(rooms.GetRoomPlayers("room-1"));
        var remaining = Assert.Single(rooms.GetRoomPlayers("room-2"));
        Assert.Equal("connection-b", remaining.ConnectionId);
        Assert.Empty(rooms.GetRoomIdsForConnection("connection-a"));
    }

    [Fact]
    public void GetRoomIdsForConnection_ReturnsEveryRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-2", "connection-a", "blue");

        var roomIds = rooms.GetRoomIdsForConnection("connection-a");

        Assert.Equal(2, roomIds.Length);
        Assert.Contains("room-1", roomIds);
        Assert.Contains("room-2", roomIds);
    }

    [Fact]
    public void GetOrCreateBarrels_ReturnsSameSetForRoom()
    {
        var rooms = NewRoomService();

        var first = rooms.GetOrCreateBarrels("room-1");
        var second = rooms.GetOrCreateBarrels("room-1");

        Assert.Same(first, second);
        Assert.Equal(10, first.Length);
        Assert.Equal(10, first.Distinct().Count());
    }

    [Fact]
    public void TrackRoomCreation_ReturnsStableTimestamp()
    {
        var rooms = NewRoomService();

        var first = rooms.TrackRoomCreation("room-1");
        var second = rooms.TrackRoomCreation("room-1");

        Assert.NotEqual(0, first);
        Assert.Equal(first, second);
        Assert.Equal(first, rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public async Task TryEvictRoom_RemovesKnownRoomAndRejectsUnknownRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackRoomCreation("room-1");
        rooms.GetOrCreateBarrels("room-1");

        Assert.True(await rooms.TryEvictRoomAsync("room-1"));
        Assert.False(await rooms.TryEvictRoomAsync("room-1"));
        Assert.False(rooms.TryGetBarrels("room-1", out _));
        Assert.Equal(0, rooms.GetRoomCreatedAt("room-1"));
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
