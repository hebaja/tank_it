using Microsoft.AspNetCore.Mvc;
using TankIt.Api.Data;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace TankIt.Api.Controllers;

// Health check / status page module (docs/GDD.md §5.3) — deliberately stateless.
[ApiController]
[Route("api/[controller]")]
public class HealthController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var stopwatch = Stopwatch.StartNew();
        var uptime = DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime();
        var version = GetType().Assembly.GetName().Version?.ToString() ?? "dev";
        try {
            var canConnect = await db.Database.CanConnectAsync();
            if (!canConnect)
                return StatusCode(503, new { status = "degraded", database = "unreachable", latencyMs = stopwatch.ElapsedMilliseconds, uptime = uptime.ToString(), version, timestamp = DateTime.UtcNow });
            await db.Database.ExecuteSqlRawAsync("SELECT 1");
            stopwatch.Stop();
            return Ok(new { status = "ok", database = "connected", latencyMs = stopwatch.ElapsedMilliseconds, uptime = uptime.ToString(), version, timestamp = DateTime.UtcNow });
        } catch (Exception ex){
            stopwatch.Stop();
            return StatusCode(503, new { status = "degraded", database = "unreachable", latencyMs = stopwatch.ElapsedMilliseconds, uptime = uptime.ToString(), version, timestamp = DateTime.UtcNow, error = ex.Message });
        }
    }
}
