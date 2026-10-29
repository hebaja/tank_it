using Microsoft.AspNetCore.SignalR;
using Moq;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Hubs;

public sealed class GameHubJoinRoomTests
{
    private const string RoomId = HubFixture.DefaultRoomId;
    private const string ConnectionId = HubFixture.DefaultConnectionId;

    [Fact]
    public async Task JoinRoom_ReturnsCallerConnectionId()
    {
        var fixture = new HubFixture();

        var joined = await fixture.Hub.JoinRoom(RoomId, "blue");

        Assert.Equal(ConnectionId, joined.ConnectionId);
        Assert.Equal(RoomId, joined.RoomId);
        Assert.Equal(10, joined.RandomBarrelPositions.Length);
        Assert.Equal(-1, joined.DeathWallStep);
        Assert.Contains(joined.Players, p => p.ConnectionId == ConnectionId && p.Color == "blue");
        fixture.Groups.Verify(
            g => g.AddToGroupAsync(ConnectionId, RoomId, It.IsAny<CancellationToken>()),
            Times.Once
        );

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task JoinRoom_NotifiesOtherPlayersInRoom()
    {
        var fixture = new HubFixture();

        await fixture.Hub.JoinRoom(RoomId, "blue");

        var playerJoined = Assert.Single(fixture.Captured.PlayerJoins);
        Assert.Equal(ConnectionId, playerJoined.ConnectionId);
        Assert.Equal("blue", playerJoined.Color);

        fixture.DeathWall.Stop(RoomId);
    }

    [Theory]
    [InlineData("", "blue")]
    [InlineData(" ", "blue")]
    [InlineData("room-1", "")]
    [InlineData("room-1", " ")]
    public async Task JoinRoom_RejectsMissingRoomOrColor(string roomId, string color)
    {
        var fixture = new HubFixture();

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.JoinRoom(roomId, color));

        fixture.DeathWall.Stop(roomId);
    }
}
