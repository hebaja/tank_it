using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // pgcrypto was previously created by db/init/schema.sql (no longer mounted);
            // migrations are now the sole schema source, so create it here.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    username = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    display_name = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    avatar_url = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "championships",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false, defaultValue: "pending"),
                    player_count = table.Column<short>(type: "smallint", nullable: false),
                    target_score = table.Column<short>(type: "smallint", nullable: false),
                    winner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_championships", x => x.id);
                    table.CheckConstraint("championships_player_count_check", "player_count BETWEEN 2 AND 4");
                    table.CheckConstraint("championships_status_check", "status IN ('pending', 'in_progress', 'completed')");
                    table.CheckConstraint("championships_target_score_check", "target_score > 0");
                    table.ForeignKey(
                        name: "fk_championships_users_created_by",
                        column: x => x.created_by,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_championships_users_winner_id",
                        column: x => x.winner_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "oauth_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    provider_user_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_oauth_accounts", x => x.id);
                    table.CheckConstraint("oauth_accounts_provider_check", "provider IN ('google', 'github', 'fortytwo')");
                    table.ForeignKey(
                        name: "fk_oauth_accounts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "player_stats",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    matches_played = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    wins = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    kills = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    deaths = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    elo_rating = table.Column<int>(type: "integer", nullable: false, defaultValue: 1000),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_stats", x => x.user_id);
                    table.ForeignKey(
                        name: "fk_player_stats_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_refresh_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "championship_participants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    championship_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_ai = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    tank_color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_championship_participants", x => x.id);
                    table.CheckConstraint("championship_participants_is_ai_user_id_check", "is_ai = true OR user_id IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_championship_participants_championships_championship_id",
                        column: x => x.championship_id,
                        principalTable: "championships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_championship_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false, defaultValue: "lobby"),
                    map_seed = table.Column<int>(type: "integer", nullable: false),
                    is_ranked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    player_count = table.Column<short>(type: "smallint", nullable: false),
                    winner_id = table.Column<Guid>(type: "uuid", nullable: true),
                    championship_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sequence_number = table.Column<short>(type: "smallint", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ended_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matches", x => x.id);
                    table.CheckConstraint("matches_championship_id_sequence_number_check", "championship_id IS NULL OR sequence_number IS NOT NULL");
                    table.CheckConstraint("matches_player_count_check", "player_count BETWEEN 2 AND 4");
                    table.CheckConstraint("matches_status_check", "status IN ('lobby', 'in_progress', 'completed', 'aborted')");
                    table.ForeignKey(
                        name: "fk_matches_championships_championship_id",
                        column: x => x.championship_id,
                        principalTable: "championships",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_matches_users_winner_id",
                        column: x => x.winner_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "match_participants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    match_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_ai = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    tank_color = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    placement = table.Column<short>(type: "smallint", nullable: true),
                    points = table.Column<short>(type: "smallint", nullable: true),
                    shots_fired = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    hits = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    kills = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    survived_seconds = table.Column<int>(type: "integer", nullable: true),
                    elo_delta = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_match_participants", x => x.id);
                    table.CheckConstraint("match_participants_is_ai_user_id_check", "is_ai = true OR user_id IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_match_participants_matches_match_id",
                        column: x => x.match_id,
                        principalTable: "matches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_match_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "idx_championship_participants_championship_id",
                table: "championship_participants",
                column: "championship_id");

            migrationBuilder.CreateIndex(
                name: "idx_championship_participants_user_id",
                table: "championship_participants",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_championship_participants_user_per_championship",
                table: "championship_participants",
                columns: new[] { "championship_id", "user_id" },
                unique: true,
                filter: "user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_championships_created_by",
                table: "championships",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "idx_championships_status",
                table: "championships",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_championships_winner_id",
                table: "championships",
                column: "winner_id");

            migrationBuilder.CreateIndex(
                name: "idx_match_participants_match_id",
                table: "match_participants",
                column: "match_id");

            migrationBuilder.CreateIndex(
                name: "idx_match_participants_user_id",
                table: "match_participants",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_match_participants_user_per_match",
                table: "match_participants",
                columns: new[] { "match_id", "user_id" },
                unique: true,
                filter: "user_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_matches_championship_id",
                table: "matches",
                column: "championship_id");

            migrationBuilder.CreateIndex(
                name: "idx_matches_status",
                table: "matches",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_matches_winner_id",
                table: "matches",
                column: "winner_id");

            migrationBuilder.CreateIndex(
                name: "uq_matches_championship_sequence",
                table: "matches",
                columns: new[] { "championship_id", "sequence_number" },
                unique: true,
                filter: "championship_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_oauth_accounts_user_id",
                table: "oauth_accounts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "oauth_accounts_provider_provider_user_id_key",
                table: "oauth_accounts",
                columns: new[] { "provider", "provider_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_player_stats_elo",
                table: "player_stats",
                column: "elo_rating")
                .Annotation("Npgsql:IndexSortOrder", new[] { SortOrder.Descending });

            migrationBuilder.CreateIndex(
                name: "idx_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "refresh_tokens_token_hash_key",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "users_email_key",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "users_username_key",
                table: "users",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "championship_participants");

            migrationBuilder.DropTable(
                name: "match_participants");

            migrationBuilder.DropTable(
                name: "oauth_accounts");

            migrationBuilder.DropTable(
                name: "player_stats");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "matches");

            migrationBuilder.DropTable(
                name: "championships");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
