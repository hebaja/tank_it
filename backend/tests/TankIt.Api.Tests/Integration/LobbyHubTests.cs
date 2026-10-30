using System.Net;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Hubs.Dtos;
using Xunit;

namespace TankIt.Api.Tests.Integration;

/// <summary>
/// Integration tests for the lobby half of GameHub (join/leave/broadcast)
/// driven through a real SignalR client over the test server — the same hub
/// the SPA talks to via frontend/app/src/net/LobbyHubConnection.ts.
/// </summary>
public class LobbyHubTests : IClassFixture<AuthApiFactory>
{
    private static readonly TimeSpan EventTimeout = TimeSpan.FromSeconds(10);

    private readonly TestServer _server;

    public LobbyHubTests(AuthApiFactory factory)
        => _server = (TestServer)factory.Services.GetRequiredService<IServer>();

    private HubConnection CreateConnection() => new HubConnectionBuilder()
        .WithUrl("http://localhost/hubs/game", options =>
        {
            options.HttpMessageHandlerFactory = _ => _server.CreateHandler();
        })
        .Build();

    private static string UniqueRoom() => "room-" + Guid.NewGuid().ToString("N")[..12];

    private static async Task<RoomJoinedDto> JoinAsync(
        HubConnection connection, string roomId, string color)
        => await connection.InvokeAsync<RoomJoinedDto>(
            "JoinRoom", roomId, color);

    [Fact]
    public async Task JoinRoom_ReturnsRoomStateWithTheCaller()
    {
        var roomId = UniqueRoom();
        await using var connection = CreateConnection();
        await connection.StartAsync();

        var status = await JoinAsync(connection, roomId, "blue");

        Assert.Equal(roomId, status.RoomId);
        var player = Assert.Single(status.Players);
        Assert.Equal("blue", player.Color);
        Assert.NotEmpty(player.ConnectionId);
        Assert.NotEqual(0, status.RoomCreatedAt);
        Assert.NotEmpty(status.RandomBarrelPositions);
    }

    [Fact]
    public async Task JoinRoom_BroadcastsPlayerJoinedToTheOthers()
    {
        var roomId = UniqueRoom();
        await using var first = CreateConnection();
        await first.StartAsync();

        var joined = new TaskCompletionSource<PlayerJoinedDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        first.On<PlayerJoinedDto>("PlayerJoined", p => joined.TrySetResult(p));

        await JoinAsync(first, roomId, "blue");

        await using var second = CreateConnection();
        await second.StartAsync();
        var secondStatus = await JoinAsync(second, roomId, "green");

        var payload = await joined.Task.WaitAsync(EventTimeout);
        Assert.Equal("green", payload.Color);
        Assert.NotEmpty(payload.ConnectionId);

        // The joiner immediately sees everyone already in the room.
        Assert.Equal(2, secondStatus.Players.Length);
        Assert.Contains(secondStatus.Players,
            p => p.Color == "blue" && p.ConnectionId != payload.ConnectionId);
    }

    [Fact]
    public async Task JoinRoom_WithoutRoomIdOrColor_Fails()
    {
        await using var connection = CreateConnection();
        await connection.StartAsync();

        await Assert.ThrowsAsync<HubException>(
            () => JoinAsync(connection, string.Empty, "blue"));
        await Assert.ThrowsAsync<HubException>(
            () => JoinAsync(connection, UniqueRoom(), " "));
    }

    [Fact]
    public async Task LeaveRoom_BroadcastsPlayerLeft_AndRemovesThePlayer()
    {
        var roomId = UniqueRoom();
        await using var first = CreateConnection();
        await first.StartAsync();
        await JoinAsync(first, roomId, "blue");

        var left = new TaskCompletionSource<PlayerLeftDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        first.On<PlayerLeftDto>("PlayerLeft", p => left.TrySetResult(p));

        string secondConnectionId;
        await using (var second = CreateConnection())
        {
            await second.StartAsync();
            var status = await JoinAsync(second, roomId, "green");
            secondConnectionId = status.Players
                .Single(p => p.Color == "green").ConnectionId;

            await second.InvokeAsync("LeaveRoom", roomId);
        }

        var payload = await left.Task.WaitAsync(EventTimeout);
        Assert.Equal(secondConnectionId, payload.ConnectionId);

        // Only the first player is left in the room.
        await using var third = CreateConnection();
        await third.StartAsync();
        var remaining = await JoinAsync(third, roomId, "red");
        Assert.Single(remaining.Players, p => p.Color == "blue");
        Assert.DoesNotContain(remaining.Players,
            p => p.ConnectionId == secondConnectionId);
    }

    [Fact]
    public async Task StartMatch_BroadcastsMatchStartedToEveryPlayer()
    {
        var roomId = UniqueRoom();
        await using var first = CreateConnection();
        await first.StartAsync();

        var firstReceived = new TaskCompletionSource<MatchStartedDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        first.On<MatchStartedDto>("MatchStarted", p => firstReceived.TrySetResult(p));
        await JoinAsync(first, roomId, "blue");

        await using var second = CreateConnection();
        await second.StartAsync();
        await JoinAsync(second, roomId, "green");

        var secondReceived = new TaskCompletionSource<MatchStartedDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        second.On<MatchStartedDto>("MatchStarted", p => secondReceived.TrySetResult(p));

        await second.InvokeAsync("StartMatch", roomId);

        var start = await firstReceived.Task.WaitAsync(EventTimeout);
        Assert.Equal(roomId, start.RoomId);
        Assert.NotEmpty(start.RandomBarrelPositions);

        var alsoStart = await secondReceived.Task.WaitAsync(EventTimeout);
        Assert.Equal(roomId, alsoStart.RoomId);
    }
}
