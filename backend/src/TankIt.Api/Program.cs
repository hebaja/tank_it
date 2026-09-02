using Microsoft.EntityFrameworkCore;
using TankIt.Api.Data;
using TankIt.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
           .UseSnakeCaseNamingConvention()); // keeps EF Core migrations aligned with
                                             // db/init/schema.sql's snake_case columns

// Frontend dev server origin; tighten/parameterize per environment once
// frontend/app's framework (and its dev port) is chosen.
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173")
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
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
