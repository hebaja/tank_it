using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;
using TankIt.Api.Hubs;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Services;

public sealed class DeathWallServiceTests
{
    private const string RoomId = "death-wall-room";

    [Fact]
    public async Task EnsureStarted_EmitsStepsOnceAndStopCancelsFutureSteps()
    {
        var clock = new FakeTimeProvider();
        var (service, steps) = CreateService(clock);

        service.EnsureStarted(RoomId);
        service.EnsureStarted(RoomId);
        Assert.Equal(-1, service.GetStep(RoomId));

        clock.Advance(DeathWallTimer.StartDelay);
        await WaitUntilAsync(() => steps.Count == 1);
        Assert.Equal(0, steps[0].Step);

        clock.Advance(DeathWallTimer.RingInterval);
        await WaitUntilAsync(() => steps.Count == 2);
        Assert.Equal(1, steps[1].Step);

        service.Stop(RoomId);
        clock.Advance(TimeSpan.FromMinutes(2));
        await Task.Delay(10);

        Assert.Equal(-1, service.GetStep(RoomId));
        Assert.Equal(2, steps.Count);
    }

    [Fact]
    public async Task Restart_ReplacesTheRoomTimerAndStartsTheDelayAgain()
    {
        var clock = new FakeTimeProvider();
        var (service, steps) = CreateService(clock);
        service.EnsureStarted(RoomId);
        clock.Advance(DeathWallTimer.StartDelay);
        await WaitUntilAsync(() => steps.Count == 1);

        service.Restart(RoomId);

        Assert.Equal(-1, service.GetStep(RoomId));
        clock.Advance(DeathWallTimer.StartDelay);
        await WaitUntilAsync(() => steps.Count == 2);
        Assert.Equal(new[] { 0, 0 }, steps.Select(step => step.Step));

        service.Stop(RoomId);
    }

    private static (DeathWallService Service, List<DeathWallStepDto> Steps) CreateService(
        TimeProvider timeProvider)
    {
        var steps = new List<DeathWallStepDto>();
        var client = new Mock<IGameClient>();
        client.Setup(game => game.DeathWallStep(It.IsAny<DeathWallStepDto>()))
            .Callback<DeathWallStepDto>(steps.Add)
            .Returns(Task.CompletedTask);
        var clients = new Mock<IHubClients<IGameClient>>();
        clients.Setup(hubs => hubs.Group(RoomId)).Returns(client.Object);
        var hub = new Mock<IHubContext<GameHub, IGameClient>>();
        hub.SetupGet(context => context.Clients).Returns(clients.Object);

        return (
            new DeathWallService(
                hub.Object,
                NullLogger<DeathWallService>.Instance,
                timeProvider),
            steps);
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!condition()) await Task.Delay(1, timeout.Token);
    }
}
