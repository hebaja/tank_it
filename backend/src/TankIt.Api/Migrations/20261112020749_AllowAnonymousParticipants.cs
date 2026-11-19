using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AllowAnonymousParticipants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "match_participants_is_ai_user_id_check",
                table: "match_participants");

            migrationBuilder.DropCheckConstraint(
                name: "championship_participants_is_ai_user_id_check",
                table: "championship_participants");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "match_participants_is_ai_user_id_check",
                table: "match_participants",
                sql: "is_ai = true OR user_id IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "championship_participants_is_ai_user_id_check",
                table: "championship_participants",
                sql: "is_ai = true OR user_id IS NOT NULL");
        }
    }
}
