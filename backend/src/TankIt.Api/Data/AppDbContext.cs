using Microsoft.EntityFrameworkCore;
using TankIt.Api.Models;

namespace TankIt.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OAuthAccount> OAuthAccounts => Set<OAuthAccount>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<MatchParticipant> MatchParticipants => Set<MatchParticipant>();
    public DbSet<PlayerStats> PlayerStats => Set<PlayerStats>();
    public DbSet<Championship> Championships => Set<Championship>();
    public DbSet<ChampionshipParticipant> ChampionshipParticipants => Set<ChampionshipParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(u => u.Username).HasMaxLength(32);
            e.Property(u => u.Email).HasMaxLength(255);
            e.Property(u => u.PasswordHash).HasMaxLength(255);
            e.Property(u => u.DisplayName).HasMaxLength(32);
            e.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
            e.Property(u => u.UpdatedAt).HasDefaultValueSql("now()");
            e.HasIndex(u => u.Username).IsUnique().HasDatabaseName("users_username_key");
            e.HasIndex(u => u.Email).IsUnique().HasDatabaseName("users_email_key");
        });

        modelBuilder.Entity<OAuthAccount>(e =>
        {
            e.ToTable("oauth_accounts", t => // avoid "o_auth_accounts" snake_case split
                t.HasCheckConstraint("oauth_accounts_provider_check",
                    "provider IN ('google', 'github', 'fortytwo')"));
            e.Property(o => o.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(o => o.Provider)
                .HasConversion<string>(p => OAuthProviderToDb(p), v => OAuthProviderFromDb(v))
                .HasMaxLength(20);
            e.Property(o => o.ProviderUserId).HasMaxLength(255);
            e.Property(o => o.CreatedAt).HasDefaultValueSql("now()");
            e.HasIndex(o => new { o.Provider, o.ProviderUserId }).IsUnique()
                .HasDatabaseName("oauth_accounts_provider_provider_user_id_key");
            e.HasIndex(o => o.UserId).HasDatabaseName("idx_oauth_accounts_user_id");
            e.HasOne(o => o.User)
                .WithMany(u => u.OAuthAccounts)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.Property(r => r.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(r => r.TokenHash).HasMaxLength(255);
            e.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
            e.HasIndex(r => r.TokenHash).IsUnique()
                .HasDatabaseName("refresh_tokens_token_hash_key");
            e.HasIndex(r => r.UserId).HasDatabaseName("idx_refresh_tokens_user_id");
            e.HasOne(r => r.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Championship>(e =>
        {
            e.Property(c => c.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(c => c.Status)
                .HasConversion<string>(s => ChampionshipStatusToDb(s), v => ChampionshipStatusFromDb(v))
                .HasMaxLength(12)
                .HasDefaultValue(ChampionshipStatus.Pending);
            e.Property(c => c.CreatedAt).HasDefaultValueSql("now()");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("championships_status_check",
                    "status IN ('pending', 'in_progress', 'completed')");
                t.HasCheckConstraint("championships_player_count_check",
                    "player_count BETWEEN 2 AND 4");
                t.HasCheckConstraint("championships_target_score_check",
                    "target_score > 0");
            });
            e.HasOne(c => c.Winner)
                .WithMany()
                .HasForeignKey(c => c.WinnerId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(c => c.Creator)
                .WithMany()
                .HasForeignKey(c => c.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(c => c.Status).HasDatabaseName("idx_championships_status");
            e.HasIndex(c => c.CreatedBy).HasDatabaseName("idx_championships_created_by");
            e.HasIndex(c => c.WinnerId).HasDatabaseName("idx_championships_winner_id");
        });

        modelBuilder.Entity<ChampionshipParticipant>(e =>
        {
            e.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(p => p.IsAi).HasDefaultValue(false);
            e.Property(p => p.TankColor).HasMaxLength(10);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("now()");
            e.ToTable(t => t.HasCheckConstraint(
                "championship_participants_is_ai_user_id_check",
                "is_ai = true OR user_id IS NOT NULL"));
            e.HasOne(p => p.Championship)
                .WithMany(c => c.Participants)
                .HasForeignKey(p => p.ChampionshipId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            // one seat per human player per championship; AI rows (UserId == null) are exempt
            e.HasIndex(p => new { p.ChampionshipId, p.UserId })
                .IsUnique()
                .HasFilter("user_id IS NOT NULL")
                .HasDatabaseName("uq_championship_participants_user_per_championship");
            e.HasIndex(p => p.ChampionshipId)
                .HasDatabaseName("idx_championship_participants_championship_id");
            e.HasIndex(p => p.UserId)
                .HasDatabaseName("idx_championship_participants_user_id");
        });

        modelBuilder.Entity<Match>(e =>
        {
            e.Property(m => m.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(m => m.Status)
                .HasConversion<string>(s => MatchStatusToDb(s), v => MatchStatusFromDb(v))
                .HasMaxLength(12)
                .HasDefaultValue(MatchStatus.Lobby);
            e.Property(m => m.IsRanked).HasDefaultValue(true);
            e.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
            e.ToTable(t =>
            {
                t.HasCheckConstraint("matches_status_check",
                    "status IN ('lobby', 'in_progress', 'completed', 'aborted')");
                t.HasCheckConstraint("matches_player_count_check",
                    "player_count BETWEEN 2 AND 4");
                t.HasCheckConstraint("matches_championship_id_sequence_number_check",
                    "championship_id IS NULL OR sequence_number IS NOT NULL");
            });
            e.HasOne(m => m.Winner)
                .WithMany()
                .HasForeignKey(m => m.WinnerId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(m => m.Championship)
                .WithMany(c => c.Matches)
                .HasForeignKey(m => m.ChampionshipId)
                .OnDelete(DeleteBehavior.Cascade);
            // match order within a championship must be unique
            e.HasIndex(m => new { m.ChampionshipId, m.SequenceNumber })
                .IsUnique()
                .HasFilter("championship_id IS NOT NULL")
                .HasDatabaseName("uq_matches_championship_sequence");
            e.HasIndex(m => m.Status).HasDatabaseName("idx_matches_status");
            e.HasIndex(m => m.ChampionshipId).HasDatabaseName("idx_matches_championship_id");
            e.HasIndex(m => m.WinnerId).HasDatabaseName("idx_matches_winner_id");
        });

        modelBuilder.Entity<MatchParticipant>(e =>
        {
            e.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(p => p.IsAi).HasDefaultValue(false);
            e.Property(p => p.TankColor).HasMaxLength(10);
            e.Property(p => p.ShotsFired).HasDefaultValue(0);
            e.Property(p => p.Hits).HasDefaultValue(0);
            e.Property(p => p.Kills).HasDefaultValue(0);
            e.ToTable(t => t.HasCheckConstraint(
                "match_participants_is_ai_user_id_check",
                "is_ai = true OR user_id IS NOT NULL"));
            e.HasOne(p => p.Match)
                .WithMany(m => m.Participants)
                .HasForeignKey(p => p.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            // one row per human player per match; AI rows (UserId == null) are exempt
            e.HasIndex(p => new { p.MatchId, p.UserId })
                .IsUnique()
                .HasFilter("user_id IS NOT NULL")
                .HasDatabaseName("uq_match_participants_user_per_match");
            e.HasIndex(p => p.MatchId).HasDatabaseName("idx_match_participants_match_id");
            e.HasIndex(p => p.UserId).HasDatabaseName("idx_match_participants_user_id");
        });

        modelBuilder.Entity<PlayerStats>(e =>
        {
            e.HasKey(s => s.UserId);
            e.Property(s => s.MatchesPlayed).HasDefaultValue(0);
            e.Property(s => s.Wins).HasDefaultValue(0);
            e.Property(s => s.Kills).HasDefaultValue(0);
            e.Property(s => s.Deaths).HasDefaultValue(0);
            e.Property(s => s.EloRating).HasDefaultValue(1000);
            e.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");
            e.HasOne(s => s.User)
                .WithOne(u => u.Stats)
                .HasForeignKey<PlayerStats>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.EloRating)
                .HasDatabaseName("idx_player_stats_elo")
                .HasAnnotation("Npgsql:IndexSortOrder",
                    new[] { Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.SortOrder.Descending });
        });
    }

    private static string OAuthProviderToDb(OAuthProvider p) => p switch
    {
        OAuthProvider.Google => "google",
        OAuthProvider.GitHub => "github",
        OAuthProvider.FortyTwo => "fortytwo",
        _ => throw new ArgumentOutOfRangeException(nameof(p))
    };

    private static OAuthProvider OAuthProviderFromDb(string v) => v switch
    {
        "google" => OAuthProvider.Google,
        "github" => OAuthProvider.GitHub,
        "fortytwo" => OAuthProvider.FortyTwo,
        _ => throw new ArgumentOutOfRangeException(nameof(v))
    };

    private static string ChampionshipStatusToDb(ChampionshipStatus s) => s switch
    {
        ChampionshipStatus.Pending => "pending",
        ChampionshipStatus.InProgress => "in_progress",
        ChampionshipStatus.Completed => "completed",
        _ => throw new ArgumentOutOfRangeException(nameof(s))
    };

    private static ChampionshipStatus ChampionshipStatusFromDb(string v) => v switch
    {
        "pending" => ChampionshipStatus.Pending,
        "in_progress" => ChampionshipStatus.InProgress,
        "completed" => ChampionshipStatus.Completed,
        _ => throw new ArgumentOutOfRangeException(nameof(v))
    };

    private static string MatchStatusToDb(MatchStatus s) => s switch
    {
        MatchStatus.Lobby => "lobby",
        MatchStatus.InProgress => "in_progress",
        MatchStatus.Completed => "completed",
        MatchStatus.Aborted => "aborted",
        _ => throw new ArgumentOutOfRangeException(nameof(s))
    };

    private static MatchStatus MatchStatusFromDb(string v) => v switch
    {
        "lobby" => MatchStatus.Lobby,
        "in_progress" => MatchStatus.InProgress,
        "completed" => MatchStatus.Completed,
        "aborted" => MatchStatus.Aborted,
        _ => throw new ArgumentOutOfRangeException(nameof(v))
    };
}
