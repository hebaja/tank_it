using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
builder.Services
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
builder.Services.AddAuthorization();

// Frontend dev server origin(s); tighten/parameterize per environment once
// frontend/app's framework (and its dev port) is chosen.
var frontendOrigins = builder.Configuration.GetSection("FrontendOrigins").Get<string[]>()
    ?? (builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173,http://localhost:3000").Split(',');

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(frontendOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

app.UseCors("Frontend");
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
