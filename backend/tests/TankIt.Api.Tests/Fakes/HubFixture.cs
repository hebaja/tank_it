using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TankIt.Api.Hubs;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Fakes;

internal sealed class HubFixture
{
    public const string DefaultConnectionId = "connection-a";
    public const string DefaultRoomId = "room-1";

    public Mock<IHubCallerClients<IGameClient>> Clients { get; } = new();
    public Mock<IGroupManager> Groups { get; } = new();
    public RecordingGameClient Captured { get; } = new();
    public DeathWallService DeathWall { get; }
    public RoomService Rooms { get; }
    public ChampionshipService Championships { get; }
    public GameHub Hub { get; }

    public HubFixture(string connectionId = DefaultConnectionId)
    {
        var hubContext = new Mock<IHubContext<GameHub, IGameClient>>();
        DeathWall = new DeathWallService(hubContext.Object, NullLogger<DeathWallService>.Instance);
        Rooms = new RoomService(new MapService(), DeathWall, NullLogger<RoomService>.Instance);
        Championships = new ChampionshipService(NullLogger<ChampionshipService>.Instance);
        Hub = new GameHub(NullLogger<GameHub>.Instance, Rooms, DeathWall, Championships)
        {
            Context = new TestHubCallerContext(connectionId),
            Clients = Clients.Object,
            Groups = Groups.Object,
        };

        Clients.Setup(c => c.OthersInGroup(DefaultRoomId)).Returns(Captured);
        Clients.Setup(c => c.Group(DefaultRoomId)).Returns(Captured);
        Groups
            .Setup(g => g.AddToGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        Groups
            .Setup(g => g.RemoveFromGroupAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    public void SetupRoom(string roomId)
    {
        Clients.Setup(c => c.OthersInGroup(roomId)).Returns(Captured);
        Clients.Setup(c => c.Group(roomId)).Returns(Captured);
    }
}
