using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchDeathsColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "deaths",
                table: "matches",
                type: "smallint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "deaths",
                table: "matches");
        }
    }
}
