using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class ChampionshipFtTargetScore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "ft",
                table: "championships",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<short>(
                name: "placement",
                table: "championship_participants",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "points",
                table: "championship_participants",
                type: "smallint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ft",
                table: "championships");

            migrationBuilder.DropColumn(
                name: "placement",
                table: "championship_participants");

            migrationBuilder.DropColumn(
                name: "points",
                table: "championship_participants");
        }
    }
}
