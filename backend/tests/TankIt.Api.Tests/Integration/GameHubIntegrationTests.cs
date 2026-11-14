using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Hubs;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Integration;

public sealed class GameHubIntegrationTests
{
    [Fact]
    public async Task JoinStartAndLeave_ExchangeEventsAcrossRealSignalRConnections()
    {
        await using var host = await TestHubHost.StartAsync();
        await using var blue = host.CreateConnection();
        await using var red = host.CreateConnection();
        var roomId = Guid.NewGuid().ToString("N");
        var playerJoined = NewSignal<PlayerJoinedDto>(blue, "PlayerJoined");
        var blueMatchStarted = NewSignal<MatchStartedDto>(blue, "MatchStarted");
        var redMatchStarted = NewSignal<MatchStartedDto>(red, "MatchStarted");
        var playerLeft = NewSignal<PlayerLeftDto>(blue, "PlayerLeft");

        await blue.StartAsync();
        var blueRoom = await blue.InvokeAsync<RoomJoinedDto>(
            "JoinRoom",
            roomId,
            "blue");
        await red.StartAsync();
        var redRoom = await red.InvokeAsync<RoomJoinedDto>(
            "JoinRoom",
            roomId,
            "red");

        Assert.Equal(roomId, blueRoom.RoomId);
        Assert.Equal(10, blueRoom.RandomBarrelPositions.Length);
        Assert.Contains(redRoom.Players, player => player.Color == "blue");
        Assert.Contains(redRoom.Players, player => player.Color == "red");
        Assert.Equal("red", (await playerJoined.Task.WaitAsync(TimeSpan.FromSeconds(5))).Color);

        await blue.InvokeAsync("StartMatch", roomId);
        Assert.Equal(roomId, (await blueMatchStarted.Task.WaitAsync(TimeSpan.FromSeconds(5))).RoomId);
        Assert.Equal(roomId, (await redMatchStarted.Task.WaitAsync(TimeSpan.FromSeconds(5))).RoomId);

        await red.InvokeAsync("LeaveRoom", roomId);
        Assert.Equal(
            redRoom.ConnectionId,
            (await playerLeft.Task.WaitAsync(TimeSpan.FromSeconds(5))).ConnectionId);
    }

    [Fact]
    public async Task Disconnect_NotifiesRemainingRoomMembers()
    {
        await using var host = await TestHubHost.StartAsync();
        await using var departing = host.CreateConnection();
        await using var remaining = host.CreateConnection();
        var roomId = Guid.NewGuid().ToString("N");
        var playerLeft = NewSignal<PlayerLeftDto>(remaining, "PlayerLeft");

        await departing.StartAsync();
        var departedRoom = await departing.InvokeAsync<RoomJoinedDto>(
            "JoinRoom",
            roomId,
            "blue");
        await remaining.StartAsync();
        await remaining.InvokeAsync<RoomJoinedDto>("JoinRoom", roomId, "red");

        await departing.StopAsync();

        Assert.Equal(
            departedRoom.ConnectionId,
            (await playerLeft.Task.WaitAsync(TimeSpan.FromSeconds(5))).ConnectionId);
    }

    private static TaskCompletionSource<T> NewSignal<T>(HubConnection connection, string name)
    {
        var signal = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<T>(name, value => signal.TrySetResult(value));
        return signal;
    }

    private sealed class TestHubHost : IAsyncDisposable
    {
        private readonly WebApplication _application;

        private TestHubHost(WebApplication application) => _application = application;

        public static async Task<TestHubHost> StartAsync()
        {
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseTestServer();
            builder.Services.AddSignalR();
            builder.Services.AddSingleton<MapService>();
            builder.Services.AddSingleton<RoomService>();
            builder.Services.AddSingleton<DeathWallService>();

            var application = builder.Build();
            application.MapHub<GameHub>("/hubs/game");
            await application.StartAsync();
            return new TestHubHost(application);
        }

        public HubConnection CreateConnection() => new HubConnectionBuilder()
            .WithUrl("http://localhost/hubs/game", options =>
            {
                options.HttpMessageHandlerFactory = _ =>
                    _application.GetTestServer().CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();

        public async ValueTask DisposeAsync()
        {
            await _application.StopAsync();
            await _application.DisposeAsync();
        }
    }
}
