using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAccountPockets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets");

            migrationBuilder.DropIndex(
                name: "IX_Pockets_AccountId",
                table: "Pockets");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "Pockets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountId",
                table: "Pockets",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Pockets_AccountId",
                table: "Pockets",
                column: "AccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id");
        }
    }
}
