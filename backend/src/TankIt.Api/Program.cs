using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TankIt.Api.Auth;
using TankIt.Api.Data;
using TankIt.Api.Hubs;
using TankIt.Api.Models;
using TankIt.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
           .UseSnakeCaseNamingConvention()); // keeps EF Core migrations aligned with
                                             // db/init/schema.sql's snake_case columns

builder.Services.AddSingleton<MapService>();
builder.Services.AddSingleton<RoomService>();
builder.Services.AddSingleton<DeathWallService>();

// Auth: Identity password hashing + JWT bearer. Key comes from
// config/env (JWT_SIGNING_KEY) — never hardcoded; fail fast if missing/short.
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
var jwtKeyBytes = TokenService.ResolveKey(builder.Configuration);
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<OAuthTicketService>();
builder.Services.Configure<OAuthTicketOptions>(
    builder.Configuration.GetSection("Authentication:Tickets"));

// JWT stays the application's default scheme. External providers only sign
// into the dedicated short-lived cookie scheme, which the unified callback
// reads once before exchanging it for the app's own JWT.
var authBuilder = builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(jwtKeyBytes),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
    });

authBuilder.AddCookie(AuthSchemes.External, o =>
{
    o.Cookie.Name = "TankIt.External";
    o.Cookie.HttpOnly = true;
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.ExpireTimeSpan = TimeSpan.FromMinutes(5);
    o.SlidingExpiration = false;
});

// Google/GitHub/42 handlers are registered only when their client id and
// secret are present, so the API still builds and runs for password auth.
authBuilder.AddExternalProviders(builder.Configuration);

builder.Services.AddAuthorization();

// Trusted SPA origin(s) for CORS. The landing app is React/Vite on :3000; the
// game dev server is on :5173. Override per environment.
var frontendOrigins = (builder.Configuration.GetSection("FrontendOrigins").Get<string[]>()
    ?? (builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173,http://localhost:3000").Split(','))
    .Select(origin => origin.Trim())
    .Where(origin => origin.Length > 0)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList();

// Keep CORS aligned with the trusted SPA callback origin, without accepting
// arbitrary origins from clients.
if (Uri.TryCreate(builder.Configuration["Frontend:Url"], UriKind.Absolute, out var frontendUri))
{
    var origin = frontendUri.GetLeftPart(UriPartial.Authority);
    if (!frontendOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        frontendOrigins.Add(origin);
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(frontendOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});

var app = builder.Build();

app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>("/hubs/game");
// liveness probe, no DB hit — real check is GET /api/health.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Apply pending EF Core migrations on boot so a fresh `make up` yields a
// working DB without manual steps (compose no longer mounts db/init).
// Opt out with ApplyMigrationsOnBoot=false — the integration-test host swaps the
// context for a non-relational provider (see tests/TankIt.Api.Tests), which can't migrate.
if (app.Configuration.GetValue("ApplyMigrationsOnBoot", true))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

app.Run();

// Exposes the generated entry point to WebApplicationFactory<Program> in the test project.
public partial class Program;
