using Microsoft.AspNetCore.Mvc;

namespace TankIt.Api.Controllers;

/// <summary>
/// Auth stub — register/login (password) + OAuth callback endpoints per docs/GDD.md §5.
/// Wire up ASP.NET Identity + JWT issuance here; not implemented yet.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    // POST /api/auth/register
    // POST /api/auth/login
    // GET  /api/auth/oauth/{provider}          (provider: google | github | fortytwo)
    // GET  /api/auth/oauth/{provider}/callback
    // POST /api/auth/refresh
}
