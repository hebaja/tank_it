using Microsoft.EntityFrameworkCore;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Hubs;

public sealed class GameHubLeaveRoomTests
{
    private const string RoomId = HubFixture.DefaultRoomId;
    private const string OtherConnectionId = "connection-b";

    [Fact]
    public async Task LeaveRoom_WithoutChampId_RemovesParticipant()
    {
        var fixture = new HubFixture();
        var other = fixture.CreateHub(OtherConnectionId);

        try
        {
            var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "championship");
            await other.JoinRoom(RoomId, "green", "championship");

            await fixture.Hub.LeaveRoom(RoomId, "");

            Assert.Equal(["green"], await StoredColorsAsync(fixture, joined.ChampionshipId));
        }
        finally
        {
            fixture.DeathWall.Stop(RoomId);
        }
    }

    [Fact]
    public async Task OnDisconnectedAsync_RemovesParticipant()
    {
        var fixture = new HubFixture();
        var other = fixture.CreateHub(OtherConnectionId);

        try
        {
            var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "championship");
            await other.JoinRoom(RoomId, "green", "championship");

            await fixture.Hub.OnDisconnectedAsync(null);

            Assert.Equal(["green"], await StoredColorsAsync(fixture, joined.ChampionshipId));
        }
        finally
        {
            fixture.DeathWall.Stop(RoomId);
        }
    }

    [Fact]
    public async Task JoinRoom_SameColorTwice_KeepsSingleSeat()
    {
        var fixture = new HubFixture();
        var other = fixture.CreateHub(OtherConnectionId);

        try
        {
            var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "championship");
            await other.JoinRoom(RoomId, "blue", "championship");

            Assert.Equal(["blue"], await StoredColorsAsync(fixture, joined.ChampionshipId));
        }
        finally
        {
            fixture.DeathWall.Stop(RoomId);
        }
    }

    [Fact]
    public async Task OnDisconnectedAsync_KeepsSeatWhenSameColorStillConnected()
    {
        var fixture = new HubFixture();
        var other = fixture.CreateHub(OtherConnectionId);

        try
        {
            var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "championship");
            await other.JoinRoom(RoomId, "blue", "championship");

            await fixture.Hub.OnDisconnectedAsync(null);

            Assert.Equal(["blue"], await StoredColorsAsync(fixture, joined.ChampionshipId));
        }
        finally
        {
            fixture.DeathWall.Stop(RoomId);
        }
    }

    private static async Task<string[]> StoredColorsAsync(HubFixture fixture, Guid? championshipId)
    {
        await using var db = fixture.NewDbContext();
        return await db.ChampionshipParticipants
            .Where(p => p.ChampionshipId == championshipId)
            .OrderBy(p => p.TankColor)
            .Select(p => p.TankColor)
            .ToArrayAsync();
    }
}
