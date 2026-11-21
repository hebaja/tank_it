using Microsoft.EntityFrameworkCore;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Models;
using TankIt.Api.Tests.Fakes;

namespace TankIt.Api.Tests.Hubs;

public sealed class GameHubModeTests
{
    private const string RoomId = HubFixture.DefaultRoomId;
    private const string OtherConnectionId = "connection-b";

    [Fact]
    public async Task JoinRoom_FirstPlayerSetsMode_LaterPlayersFollowRoomMode()
    {
        var fixture = new HubFixture();

        var first = await fixture.Hub.JoinRoom(RoomId, "blue", "single");
        var second = await fixture
            .CreateHub(OtherConnectionId)
            .JoinRoom(RoomId, "green", "championship");

        Assert.Equal("single", first.Mode);
        Assert.Equal("single", second.Mode);

        await using var db = fixture.NewDbContext();
        var stored = await db.Championships
            .SingleAsync(c => c.Id == first.ChampionshipId);

        Assert.Equal(GameMode.SingleMatch, stored.Mode);

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task StartMatch_BroadcastsSessionMode()
    {
        var fixture = new HubFixture();
        var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "single");

        await fixture.Hub.StartMatch(
            RoomId,
            joined.ChampionshipId!.Value.ToString());

        var started = Assert.Single(fixture.Captured.MatchStarts);
        Assert.Equal("single", started.Mode);

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task TankDestroy_SingleMatch_EndsWithoutChampionshipWinner()
    {
        var fixture = new HubFixture();
        var blue = await fixture.Hub.JoinRoom(RoomId, "blue", "single");
        await fixture
            .CreateHub(OtherConnectionId)
            .JoinRoom(RoomId, "green", "single");

        var championshipId = blue.ChampionshipId!.Value.ToString();

        await fixture.Hub.StartMatch(RoomId, championshipId);
        await fixture.Hub.TankDestroy(new TankDestroyRequest
        {
            RoomId = RoomId,
            ChampionshipId = championshipId,
            Color = "blue",
        });

        var ended = Assert.Single(fixture.Captured.MatchEnds);

        Assert.Equal("single", ended.Mode);
        Assert.False(ended.IsChampionship);
        Assert.Null(ended.ChampionshipWinnerId);
        Assert.All(
            ended.TanksScore,
            score => Assert.False(score.IsChampionshipWinner));
        Assert.Equal(
            (short?)1,
            ended.TanksScore.Single(s => s.Color == "green").Score);

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task FinishChampionship_SingleMatch_EvictsSession()
    {
        var fixture = new HubFixture();
        await fixture.Hub.JoinRoom(RoomId, "blue", "single");

        await fixture.Hub.FinishChampionship(RoomId);

        Assert.Single(fixture.Captured.ChampionshipFinishes);
        Assert.False(fixture.Championships.TryGetByRoomId(RoomId, out _));

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task FinishChampionship_ChampionshipWithoutWinner_DoesNotEvict()
    {
        var fixture = new HubFixture();
        await fixture.Hub.JoinRoom(RoomId, "blue", "championship");

        await fixture.Hub.FinishChampionship(RoomId);

        Assert.Empty(fixture.Captured.ChampionshipFinishes);
        Assert.True(fixture.Championships.TryGetByRoomId(RoomId, out _));

        fixture.DeathWall.Stop(RoomId);
    }

    [Fact]
    public async Task StartMatch_ActiveColorsExcludesEliminatedPlayers()
    {
        var fixture = new HubFixture();
        var joined = await fixture.Hub.JoinRoom(RoomId, "blue", "championship");
        await fixture.CreateHub(OtherConnectionId).JoinRoom(RoomId, "green", "championship");

        var championship = await fixture.Championships.GetAsync(joined.ChampionshipId!.Value);
        Assert.NotNull(championship);
        championship!.Participants.Single(p => p.TankColor == "green")
            .IsEliminatedFromChampionship = true;

        await fixture.Hub.StartMatch(RoomId, joined.ChampionshipId!.Value.ToString());

        var started = Assert.Single(fixture.Captured.MatchStarts);
        Assert.Equal(["blue"], started.ActiveColors);

        fixture.DeathWall.Stop(RoomId);
    }
}
