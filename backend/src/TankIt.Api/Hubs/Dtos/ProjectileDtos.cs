namespace TankIt.Api.Hubs.Dtos;

public sealed class FireProjectileRequest
{
    public string RoomId {get; init; } = "";
    public string OwnerId {get; init; } = "";
    public string ProjectileId {get; init; } = "";
    public PositionDto Origin { get; init; } = new();
    public double Angle { get; init; }
    public long Timestamp { get; init; }
    public int Sequence { get; init; }
}

public sealed class ProjectileSpawnedPayload
{
    public string RoomId { get; init; } = "";
    public string ProjectileId { get; init; } = "";
    public string OwnerId { get; init; } = "";
    public PositionDto Position { get; init; } = new();
    public double Angle { get; init; }
    public long Timestamp { get; init; }
}

public sealed class ProjectileHitRequest
{
    public string RoomId { get; init; } = "";
    public string ProjectileId { get; init; } = "";
    public HitInfoDto Hit { get; init; } = new();
    public PositionDto Position { get; init; } = new();
    public long Timestamp { get; init; }
    public int Sequence { get; init; }
}

public sealed class ProjectileDestroyedPayload
{
    public string RoomId { get; init; } = "";
    public string ProjectileId { get; init; } = "";
    public HitInfoDto Hit { get; init; } = new();
    public PositionDto Position { get; init; } = new();
    public long Timestamp { get; init; }
}

public sealed class HitInfoDto
{
    public string Type { get; init; } = HitTypes.Bounds;
    public string? TargetId { get; init; } 
     public PositionDto? TargetPosition { get; init; } = new();
}

public static class HitTypes
{
    public const string Block = "block";
    public const string BlockHard = "blockHard";
    public const string Barrel = "barrel";
    public const string Tank = "tank";
    public const string Projectile = "projectile";
    public const string Bounds = "bounds";
}