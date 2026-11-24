public enum GameMode
{
    SingleMatch,
    Championship
}

public static class GameModeExtensions
{
    public static string ToWireValue(this GameMode mode) => mode switch
    {
        GameMode.SingleMatch => "single",
        GameMode.Championship => "championship",
        _ => throw new ArgumentOutOfRangeException(nameof(mode))
    };

    public static GameMode FromWireValue(string? value) => value switch
    {
        null or "" or "single" => GameMode.SingleMatch,
        "championship" => GameMode.Championship,
        _ => throw new ArgumentException($"Unknown game mode '{value}'", nameof(value))
    };
}
