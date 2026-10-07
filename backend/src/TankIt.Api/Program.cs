using Microsoft.EntityFrameworkCore;
using TankIt.Api.Data;
using TankIt.Api.Hubs;
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

// TODO: builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)... — wire once
// the auth flow (password + OAuth) design in docs/GDD.md is implemented.

var app = builder.Build();

app.UseCors("Frontend");
app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>("/hubs/game");
// liveness probe, no DB hit — real check is GET /api/health.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Apply pending EF Core migrations on boot so a fresh `make up` yields a
// working DB without manual steps (compose no longer mounts db/init).
using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();

app.Run();
