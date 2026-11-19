using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddChampionshipWinnerColorColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "winner_color",
                table: "championships",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "winner_color",
                table: "championships");
        }
    }
}
