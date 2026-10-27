using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TankIt.Api.Controllers;
using TankIt.Api.Data;

namespace TankIt.Api.Tests.Controllers;

public sealed class HealthControllerTests
{
    [Fact]
    public async Task Get_ReturnsDegradedWhenDatabaseProviderIsUnavailable()
    {
        await using var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().Options);
        var controller = new HealthController(db);

        var result = await controller.Get();

        var response = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, response.StatusCode);
        Assert.Equal("degraded", response.Value?.GetType().GetProperty("status")?.GetValue(response.Value));
        Assert.Equal("unreachable", response.Value?.GetType().GetProperty("database")?.GetValue(response.Value));
    }
}
