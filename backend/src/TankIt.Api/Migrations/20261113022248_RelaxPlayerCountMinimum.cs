using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class RelaxPlayerCountMinimum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "matches_player_count_check",
                table: "matches");

            migrationBuilder.DropCheckConstraint(
                name: "championships_player_count_check",
                table: "championships");

            migrationBuilder.AddCheckConstraint(
                name: "matches_player_count_check",
                table: "matches",
                sql: "player_count BETWEEN 1 AND 4");

            migrationBuilder.AddCheckConstraint(
                name: "championships_player_count_check",
                table: "championships",
                sql: "player_count BETWEEN 1 AND 4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "matches_player_count_check",
                table: "matches");

            migrationBuilder.DropCheckConstraint(
                name: "championships_player_count_check",
                table: "championships");

            migrationBuilder.AddCheckConstraint(
                name: "matches_player_count_check",
                table: "matches",
                sql: "player_count BETWEEN 2 AND 4");

            migrationBuilder.AddCheckConstraint(
                name: "championships_player_count_check",
                table: "championships",
                sql: "player_count BETWEEN 2 AND 4");
        }
    }
}
