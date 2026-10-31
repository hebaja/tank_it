using System.Collections.Concurrent;
using TankIt.Api.Models;

public sealed class ChampionshipService(ILogger<ChampionshipService> logger)
{
    private readonly ConcurrentDictionary<Guid, Championship> _championships = new();
    private readonly ILogger<ChampionshipService> _logger = logger;

    public (Championship Championship, bool Created) GetOrCreate(Guid id)
    {
        if (_championships.TryGetValue(id, out var existing))
            return (existing, false);

        var championship = new Championship
        {
            Id = Guid.NewGuid(),
            TargetScore = 7,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (_championships.TryAdd(id, championship))
        {
             _logger.LogInformation(
                "Championship {ChampionshipId} created in memory",
                id);

            return (championship, true);
        }

        return (_championships[id], false);
    }

    public bool TryGet(Guid id, out Championship? championship)
        => _championships.TryGetValue(id, out championship);
}
