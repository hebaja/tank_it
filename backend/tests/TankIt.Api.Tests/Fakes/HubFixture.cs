using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TankIt.Api.Data;
using TankIt.Api.Hubs;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Fakes;

internal sealed class HubFixture
{
    public const string DefaultConnectionId = "connection-a";
    public const string DefaultRoomId = "room-1";

    public Mock<IHubCallerClients<IGameClient>> Clients { get; } = new();
    public Mock<IHubContext<GameHub, IGameClient>> HubContext { get; } = new();
    public Mock<IGroupManager> Groups { get; } = new();
    public RecordingGameClient Captured { get; } = new();
    public DeathWallService DeathWall { get; }
    public RoomService Rooms { get; }
    public ChampionshipService Championships { get; }
    public MatchSettlementService Settlement { get; }
    public GameHub Hub { get; }
    public ServiceProvider Services { get; }

    private readonly DbContextOptions<AppDbContext> _dbOptions;

    public HubFixture(
        string connectionId = DefaultConnectionId,
        MatchSettlementOptions? settlementOptions = null)
    {
        // In-memory EF provider: the write-through repository runs for real,
        // so tests exercise the same code path as production (minus Postgres).
        var services = new ServiceCollection();
        var databaseName = $"championships-{Guid.NewGuid()}";
        _dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(databaseName));
        services.AddScoped<ChampionshipRepository>();
        Services = services.BuildServiceProvider();

        DeathWall = new DeathWallService(HubContext.Object, NullLogger<DeathWallService>.Instance);
        Championships = new ChampionshipService(
            NullLogger<ChampionshipService>.Instance,
            Services.GetRequiredService<IServiceScopeFactory>());
        Rooms = new RoomService(
            new MapService(),
            DeathWall,
            Championships,
            NullLogger<RoomService>.Instance);
        Settlement = new MatchSettlementService(
            Championships,
            DeathWall,
            HubContext.Object,
            TimeProvider.System,
            settlementOptions ?? new MatchSettlementOptions
            {
                TieWindow = TimeSpan.Zero,
                SettlementGrace = TimeSpan.Zero,
            },
            NullLogger<MatchSettlementService>.Instance);
        Hub = new GameHub(
            NullLogger<GameHub>.Instance,
            Rooms,
            DeathWall,
            Championships,
            Settlement)
        {
            Context = new TestHubCallerContext(connectionId),
            Clients = Clients.Object,
            Groups = Groups.Object,
        };

        SetupRoom(DefaultRoomId);
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

    public GameHub CreateHub(string connectionId)
        => new(
            NullLogger<GameHub>.Instance,
            Rooms,
            DeathWall,
            Championships,
            Settlement)
        {
            Context = new TestHubCallerContext(connectionId),
            Clients = Clients.Object,
            Groups = Groups.Object,
        };

    public AppDbContext NewDbContext() => new(_dbOptions);

    public void SetupRoom(string roomId)
    {
        Clients.Setup(c => c.OthersInGroup(roomId)).Returns(Captured);
        Clients.Setup(c => c.Group(roomId)).Returns(Captured);
        HubContext.Setup(c => c.Clients.Group(roomId)).Returns(Captured);
    }
}
