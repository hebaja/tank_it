using System.Text.Json;
using TankIt.Api.Hubs.Dtos;

namespace TankIt.Api.Tests.Contracts;

public sealed class ProjectileContractTests
{
    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    [Fact]
    public void ProjectileFire_UsesCamelCaseWireNames()
    {
        var payload = NewProjectile();

        var json = JsonSerializer.Serialize(payload, WebJson);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("room-1", root.GetProperty("roomId").GetString());
        Assert.Equal("blue", root.GetProperty("ownerId").GetString());
        Assert.Equal("projectile-1", root.GetProperty("projectileId").GetString());
        Assert.Equal(100, root.GetProperty("origin").GetProperty("x").GetDouble());
        Assert.Equal(200, root.GetProperty("origin").GetProperty("y").GetDouble());
        Assert.Equal(45, root.GetProperty("angle").GetDouble());
        Assert.Equal("blue", root.GetProperty("color").GetString());
        Assert.Equal(123456789, root.GetProperty("timestamp").GetInt64());
        Assert.Equal(7, root.GetProperty("sequence").GetInt32());
    }

    [Fact]
    public void ProjectilesCollide_RoundTripsFrontendPayload()
    {
        const string json = """
            {
              "projectileA": {
                "roomId": "room-1",
                "ownerId": "blue",
                "projectileId": "projectile-a",
                "origin": { "x": 10, "y": 20 },
                "angle": 90,
                "color": "blue",
                "timestamp": 111,
                "sequence": 1
              },
              "projectileB": {
                "roomId": "room-1",
                "ownerId": "red",
                "projectileId": "projectile-b",
                "origin": { "x": 30, "y": 40 },
                "angle": 180,
                "color": "red",
                "timestamp": 112,
                "sequence": 2
              },
              "timestamp": 113
            }
            """;

        var payload = JsonSerializer.Deserialize<ProjectilesCollideRequest>(json, WebJson);

        Assert.NotNull(payload);
        Assert.Equal("projectile-a", payload.ProjectileA.ProjectileId);
        Assert.Equal("red", payload.ProjectileB.Color);
        Assert.Equal(30, payload.ProjectileB.Origin.X);
        Assert.Equal(113, payload.Timestamp);
    }

    private static ProjectileFireRequest NewProjectile() =>
        new()
        {
            RoomId = "room-1",
            OwnerId = "blue",
            ProjectileId = "projectile-1",
            Origin = new PositionDto { X = 100, Y = 200 },
            Angle = 45,
            Color = "blue",
            Timestamp = 123456789,
            Sequence = 7,
        };
}
