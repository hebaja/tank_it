using Microsoft.AspNetCore.SignalR;
using Moq;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Hubs;

public sealed class GameHubEventTests
{
    private const string RoomId = HubFixture.DefaultRoomId;

    [Fact]
    public async Task TankMove_BroadcastsMovementToOtherRoomMembers()
    {
        var fixture = new HubFixture();
        var request = new TankMoveRequest
        {
            RoomId = RoomId,
            PlayerId = "blue",
            Position = new PositionDto { X = 125, Y = 240 },
            Rotation = 90,
            Sequence = 4,
            Timestamp = 123,
        };

        await fixture.Hub.TankMove(request);

        Assert.Same(request, Assert.Single(fixture.Captured.TankMoves));
        fixture.Clients.Verify(clients => clients.OthersInGroup(RoomId), Times.Once);
    }

    [Fact]
    public async Task DestroyEvents_BroadcastToOtherRoomMembers()
    {
        var fixture = new HubFixture();
        var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "single");
        await fixture.Hub.StartMatch(RoomId, joined.ChampionshipId!.Value.ToString());
        var block = new BlockDestroyRequest { RoomId = RoomId, TileX = 3, TileY = 4 };
        var barrel = new BarrelDestroyRequest { RoomId = RoomId, Index = 2 };
        var tank = new TankDestroyRequest { RoomId = RoomId, Color = "blue" };

        await fixture.Hub.BlockDestroy(block);
        await fixture.Hub.BarrelDestroy(barrel);
        await fixture.Hub.TankDestroy(tank);

        Assert.Same(block, Assert.Single(fixture.Captured.BlockDestroys));
        Assert.Same(barrel, Assert.Single(fixture.Captured.BarrelDestroys));
        Assert.Same(tank, Assert.Single(fixture.Captured.TankDestroys));
        fixture.Clients.Verify(clients => clients.OthersInGroup(RoomId), Times.AtLeast(3));
        fixture.DeathWall.Stop(RoomId);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task TankMove_RejectsMissingRoom(string roomId)
    {
        var fixture = new HubFixture();

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.TankMove(
            new TankMoveRequest { RoomId = roomId }));
    }

    [Fact]
    public async Task MatchEnd_SettlesMatchWithoutClientSuppliedPlacements()
    {
        var fixture = new HubFixture();
        var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "single");
        await fixture.Hub.StartMatch(RoomId, joined.ChampionshipId!.Value.ToString());
        var request = new MatchEndRequest
        {
            RoomId = RoomId,
            ChampionshipId = joined.ChampionshipId!.Value.ToString(),
        };

        await fixture.Hub.MatchEnd(request);
        await fixture.Hub.TankDestroy(new TankDestroyRequest { RoomId = RoomId, Color = "blue" });

        var ended = Assert.Single(fixture.Captured.MatchEnds);
        Assert.Equal("single", ended.Mode);
        Assert.Single(ended.TanksScore);
        Assert.Equal("blue", Assert.Single(ended.TanksScore).Color);
        fixture.DeathWall.Stop(RoomId);
    }
}
