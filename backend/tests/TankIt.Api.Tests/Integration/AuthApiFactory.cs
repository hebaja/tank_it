using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Data;

namespace TankIt.Api.Tests.Integration;

/// <summary>
/// Hosts the real ASP.NET pipeline (routing, model validation, JSON contract,
/// JWT configuration) over an isolated in-memory database per factory, so the
/// auth endpoints can be exercised over HTTP without Postgres.
/// </summary>
public class AuthApiFactory : WebApplicationFactory<Program>
{
    /// <summary>Fixed test key — Program.cs fails fast without a 32+ byte key.</summary>
    public const string SigningKey =
        "integration-test-signing-key-0123456789abcdef0123";

    private readonly string _databaseName = $"tankit-tests-{Guid.NewGuid()}";

    static AuthApiFactory()
    {
        // Read by Program.cs while it builds the host: skip migrations (the
        // context is swapped for a non-relational provider below) and always
        // provide a valid JWT signing key regardless of the developer's .env.
        Environment.SetEnvironmentVariable("ApplyMigrationsOnBoot", "false");
        Environment.SetEnvironmentVariable("JWT_SIGNING_KEY", SigningKey);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ApplyMigrationsOnBoot", "false");
        builder.UseSetting("JWT_SIGNING_KEY", SigningKey);

        builder.ConfigureServices(services =>
        {
            // Drop the Npgsql options Program.cs registered (both the resolved
            // options and the deferred configuration they are built from)…
            var relational = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                    || d.ServiceType == typeof(DbContextOptions)
                    || d.ServiceType
                        == typeof(IDbContextOptionsConfiguration<AppDbContext>))
                .ToList();
            foreach (var descriptor in relational)
                services.Remove(descriptor);

            // …and back the context with an isolated in-memory database.
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }
}
