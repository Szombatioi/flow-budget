using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class Wishlist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WishlistId",
                table: "Expenditures",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WishlistId",
                table: "DailyExpenses",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Wishlists",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Mode = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Goal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TargetDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AccountId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Wishlists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Wishlists_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenditures_WishlistId",
                table: "Expenditures",
                column: "WishlistId");

            migrationBuilder.CreateIndex(
                name: "IX_DailyExpenses_WishlistId",
                table: "DailyExpenses",
                column: "WishlistId");

            migrationBuilder.CreateIndex(
                name: "IX_Wishlists_AccountId",
                table: "Wishlists",
                column: "AccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_DailyExpenses_Wishlists_WishlistId",
                table: "DailyExpenses",
                column: "WishlistId",
                principalTable: "Wishlists",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenditures_Wishlists_WishlistId",
                table: "Expenditures",
                column: "WishlistId",
                principalTable: "Wishlists",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DailyExpenses_Wishlists_WishlistId",
                table: "DailyExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenditures_Wishlists_WishlistId",
                table: "Expenditures");

            migrationBuilder.DropTable(
                name: "Wishlists");

            migrationBuilder.DropIndex(
                name: "IX_Expenditures_WishlistId",
                table: "Expenditures");

            migrationBuilder.DropIndex(
                name: "IX_DailyExpenses_WishlistId",
                table: "DailyExpenses");

            migrationBuilder.DropColumn(
                name: "WishlistId",
                table: "Expenditures");

            migrationBuilder.DropColumn(
                name: "WishlistId",
                table: "DailyExpenses");
        }
    }
}
