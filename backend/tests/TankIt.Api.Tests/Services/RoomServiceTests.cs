using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Services;
using Xunit;

namespace TankIt.Api.Tests.Services;

/// <summary>
/// Unit tests for the in-memory lobby bookkeeping behind GameHub
/// (backend/src/TankIt.Api/Services/RoomService.cs).
/// </summary>
public class RoomServiceTests : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly RoomService _rooms;

    public RoomServiceTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSignalR();
        services.AddSingleton<MapService>();
        services.AddSingleton<DeathWallService>();
        services.AddSingleton<RoomService>();
        _provider = services.BuildServiceProvider();
        _rooms = _provider.GetRequiredService<RoomService>();
    }

    public void Dispose() => _provider.Dispose();

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
    public void TrackLeave_RemovesPlayerAndEvictsTheEmptyRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackRoomCreation("room-1");
        _rooms.GetOrCreateBarrels("room-1");
        Assert.NotEqual(0, _rooms.GetRoomCreatedAt("room-1"));

        _rooms.TrackLeave("room-1", "conn-a");

        Assert.Empty(_rooms.GetRoomPlayers("room-1"));
        Assert.Empty(_rooms.GetRoomIdsForConnection("conn-a"));
        // Eviction drops the room metadata, so a later join starts fresh.
        Assert.Equal(0, _rooms.GetRoomCreatedAt("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
    }

    [Fact]
    public void TrackLeave_KeepsTheRoomAliveWhileSomeoneStays()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-1", "conn-b", "green");
        _rooms.TrackRoomCreation("room-1");

        _rooms.TrackLeave("room-1", "conn-b");

        Assert.Single(_rooms.GetRoomPlayers("room-1"));
        Assert.NotEqual(0, _rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public void TrackDisconnect_LeavesEveryRoomTheConnectionWasIn()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackJoin("room-2", "conn-a", "green");
        _rooms.TrackJoin("room-1", "conn-b", "red");

        _rooms.TrackDisconnect("conn-a");

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
    public void TryEvictRoom_RemovesKnownRoomAndRejectsUnknownRoom()
    {
        _rooms.TrackJoin("room-1", "conn-a", "blue");
        _rooms.TrackRoomCreation("room-1");
        _rooms.GetOrCreateBarrels("room-1");

        Assert.True(_rooms.TryEvictRoom("room-1"));
        Assert.False(_rooms.TryEvictRoom("room-1"));
        Assert.False(_rooms.TryGetBarrels("room-1", out _));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("room-1"));
    }

    [Fact]
    public void UnknownRoom_IsHarmless()
    {
        Assert.Empty(_rooms.GetRoomPlayers("nope"));
        Assert.Equal(0, _rooms.GetRoomCreatedAt("nope"));
        Assert.False(_rooms.TryEvictRoom("nope"));

        // Leaving a room/connection nobody ever joined must not throw.
        _rooms.TrackLeave("nope", "ghost");
        _rooms.TrackDisconnect("ghost");
    }
}
