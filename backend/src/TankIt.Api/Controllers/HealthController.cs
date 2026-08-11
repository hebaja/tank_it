using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TankIt.Api.Data;

namespace TankIt.Api.Controllers;

// Health check / status page module (docs/GDD.md §5.3) — deliberately stateless.
[ApiController]
[Route("api/[controller]")]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var canConnect = await db.Database.CanConnectAsync();
        return canConnect
            ? Ok(new { status = "ok", database = "connected" })
            : StatusCode(503, new { status = "degraded", database = "unreachable" });
    }
}
