using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddChampionshipMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "mode",
                table: "championships",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValueSql: "'championship'");

            migrationBuilder.AddCheckConstraint(
                name: "championships_mode_check",
                table: "championships",
                sql: "mode IN ('single', 'championship')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "championships_mode_check",
                table: "championships");

            migrationBuilder.DropColumn(
                name: "mode",
                table: "championships");
        }
    }
}
