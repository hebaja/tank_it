using Microsoft.AspNetCore.SignalR;
using Moq;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Hubs;

public sealed class GameHubProjectileTests
{
    private const string RoomId = HubFixture.DefaultRoomId;
    private const string ConnectionId = HubFixture.DefaultConnectionId;

    [Fact]
    public async Task ProjectileFire_BroadcastsToOtherPlayersInRoom()
    {
        var fixture = new HubFixture();
        var payload = NewProjectile("blue", "projectile-1");

        await fixture.Hub.ProjectileFire(payload);

        Assert.Same(payload, Assert.Single(fixture.Captured.ProjectileFires));
        fixture.Clients.Verify(c => c.OthersInGroup(RoomId), Times.Once);
    }

    [Fact]
    public async Task ProjectileFire_DoesNotBroadcastToCaller()
    {
        var fixture = new HubFixture();
        var payload = NewProjectile("blue", "projectile-1");

        await fixture.Hub.ProjectileFire(payload);

        fixture.Clients.Verify(c => c.Group(It.IsAny<string>()), Times.Never);
        fixture.Clients.Verify(c => c.All, Times.Never);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task ProjectileFire_RejectsMissingRoom(string roomId)
    {
        var fixture = new HubFixture();
        var payload = NewProjectile("blue", "projectile-1", roomId);

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.ProjectileFire(payload));
    }

    [Fact]
    public async Task ProjectileDestroy_BroadcastsToOtherPlayersInRoom()
    {
        var fixture = new HubFixture();
        var payload = NewProjectile("red", "projectile-2");

        await fixture.Hub.ProjectileDestroy(payload);

        Assert.Same(payload, Assert.Single(fixture.Captured.ProjectileDestroys));
        fixture.Clients.Verify(c => c.OthersInGroup(RoomId), Times.Once);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task ProjectileDestroy_RejectsMissingRoom(string roomId)
    {
        var fixture = new HubFixture();
        var payload = NewProjectile("red", "projectile-2", roomId);

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.ProjectileDestroy(payload));
    }

    [Fact]
    public async Task ProjectilesCollide_ExcludesBothProjectileOwners()
    {
        var fixture = new HubFixture();
        fixture.Rooms.TrackJoin(RoomId, "connection-a", "blue");
        fixture.Rooms.TrackJoin(RoomId, "connection-b", "red");
        fixture.Rooms.TrackJoin(RoomId, "connection-c", "green");

        IReadOnlyList<string>? excluded = null;
        fixture.Clients
            .Setup(c => c.GroupExcept(RoomId, It.IsAny<IReadOnlyList<string>>()))
            .Callback<string, IReadOnlyList<string>>((_, ids) => excluded = ids)
            .Returns(fixture.Captured);

        var payload = NewCollision(
            NewProjectile("blue", "projectile-a"),
            NewProjectile("red", "projectile-b")
        );

        await fixture.Hub.ProjectilesCollide(payload);

        Assert.NotNull(excluded);
        Assert.Equal(2, excluded.Count);
        Assert.Contains("connection-a", excluded);
        Assert.Contains("connection-b", excluded);
        Assert.DoesNotContain("connection-c", excluded);
        Assert.Same(payload, Assert.Single(fixture.Captured.ProjectileCollisions));
    }

    [Fact]
    public async Task ProjectilesCollide_DoesNotExcludePlayersFromOtherRooms()
    {
        var fixture = new HubFixture();
        fixture.Rooms.TrackJoin(RoomId, "connection-a", "blue");
        fixture.Rooms.TrackJoin(RoomId, "connection-b", "red");
        fixture.Rooms.TrackJoin("room-2", "connection-other", "green");

        IReadOnlyList<string>? excluded = null;
        fixture.Clients
            .Setup(c => c.GroupExcept(RoomId, It.IsAny<IReadOnlyList<string>>()))
            .Callback<string, IReadOnlyList<string>>((_, ids) => excluded = ids)
            .Returns(fixture.Captured);

        await fixture.Hub.ProjectilesCollide(
            NewCollision(
                NewProjectile("blue", "projectile-a"),
                NewProjectile("red", "projectile-b")
            )
        );

        Assert.NotNull(excluded);
        Assert.DoesNotContain("connection-other", excluded);
    }

    [Fact]
    public async Task ProjectilesCollide_ExcludesDuplicateColorsOnce()
    {
        var fixture = new HubFixture();
        fixture.Rooms.TrackJoin(RoomId, "connection-a", "blue");
        fixture.Rooms.TrackJoin(RoomId, "connection-b", "blue");

        IReadOnlyList<string>? excluded = null;
        fixture.Clients
            .Setup(c => c.GroupExcept(RoomId, It.IsAny<IReadOnlyList<string>>()))
            .Callback<string, IReadOnlyList<string>>((_, ids) => excluded = ids)
            .Returns(fixture.Captured);

        await fixture.Hub.ProjectilesCollide(
            NewCollision(
                NewProjectile("blue", "projectile-a"),
                NewProjectile("blue", "projectile-b")
            )
        );

        Assert.NotNull(excluded);
        Assert.Equal(2, excluded.Count);
        Assert.Equal(excluded.Count, excluded.Distinct().Count());
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task ProjectilesCollide_RejectsMissingRoom(string roomId)
    {
        var fixture = new HubFixture();
        var payload = NewCollision(
            NewProjectile("blue", "projectile-a", roomId),
            NewProjectile("red", "projectile-b")
        );

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.ProjectilesCollide(payload));
    }

    [Fact]
    public async Task ProjectilesCollide_RejectsProjectilesFromDifferentRooms()
    {
        var fixture = new HubFixture();
        var payload = NewCollision(
            NewProjectile("blue", "projectile-a", RoomId),
            NewProjectile("red", "projectile-b", "room-2")
        );

        await Assert.ThrowsAsync<HubException>(() => fixture.Hub.ProjectilesCollide(payload));
    }

    private static ProjectileFireRequest NewProjectile(
        string color,
        string projectileId,
        string roomId = RoomId
    ) =>
        new()
        {
            RoomId = roomId,
            OwnerId = color,
            Color = color,
            ProjectileId = projectileId,
            Origin = new PositionDto { X = 100, Y = 200 },
            Angle = 45,
            Timestamp = 123456789,
            Sequence = 7,
        };

    private static ProjectilesCollideRequest NewCollision(
        ProjectileFireRequest projectileA,
        ProjectileFireRequest projectileB
    ) =>
        new()
        {
            ProjectileA = projectileA,
            ProjectileB = projectileB,
            Timestamp = 123456790,
        };
}
