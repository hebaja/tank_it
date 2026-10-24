using Microsoft.Extensions.Logging.Abstractions;
using TankIt.Api.Services;

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
    public void TrackLeave_RemovesPlayerAndEvictsEmptyRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackRoomCreation("room-1");
        rooms.GetOrCreateBarrels("room-1");

        rooms.TrackLeave("room-1", "connection-a");

        Assert.Empty(rooms.GetRoomPlayers("room-1"));
        Assert.Equal(0, rooms.GetRoomCreatedAt("room-1"));
        Assert.False(rooms.TryGetBarrels("room-1", out _));
        Assert.Empty(rooms.GetRoomIdsForConnection("connection-a"));
    }

    [Fact]
    public void TrackLeave_KeepsRoomWhilePlayersRemain()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-1", "connection-b", "red");

        rooms.TrackLeave("room-1", "connection-a");

        var player = Assert.Single(rooms.GetRoomPlayers("room-1"));
        Assert.Equal("connection-b", player.ConnectionId);
    }

    [Fact]
    public void TrackDisconnect_RemovesConnectionFromEveryRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackJoin("room-2", "connection-a", "blue");
        rooms.TrackJoin("room-2", "connection-b", "red");

        rooms.TrackDisconnect("connection-a");

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
    public void TryEvictRoom_RemovesKnownRoomAndRejectsUnknownRoom()
    {
        var rooms = NewRoomService();
        rooms.TrackJoin("room-1", "connection-a", "blue");
        rooms.TrackRoomCreation("room-1");
        rooms.GetOrCreateBarrels("room-1");

        Assert.True(rooms.TryEvictRoom("room-1"));
        Assert.False(rooms.TryEvictRoom("room-1"));
        Assert.False(rooms.TryGetBarrels("room-1", out _));
        Assert.Equal(0, rooms.GetRoomCreatedAt("room-1"));
    }

    private static RoomService NewRoomService()
    {
        var deathWall = new DeathWallService(
            Moq.Mock.Of<Microsoft.AspNetCore.SignalR.IHubContext<TankIt.Api.Hubs.GameHub, TankIt.Api.Hubs.IGameClient>>(),
            NullLogger<DeathWallService>.Instance
        );
        return new RoomService(new MapService(), deathWall, NullLogger<RoomService>.Instance);
    }
}
