using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TankIt.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOAuthLoginTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "oauth_login_tickets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    purpose = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "login"),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_oauth_login_tickets", x => x.id);
                    table.CheckConstraint("oauth_login_tickets_purpose_check", "purpose IN ('login', 'link')");
                    table.ForeignKey(
                        name: "fk_oauth_login_tickets_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_oauth_login_tickets_expires_at",
                table: "oauth_login_tickets",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "idx_oauth_login_tickets_user_id",
                table: "oauth_login_tickets",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "oauth_login_tickets_code_hash_key",
                table: "oauth_login_tickets",
                column: "code_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "oauth_login_tickets");
        }
    }
}
