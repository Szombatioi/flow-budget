using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class Income : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CostBudgets_Accounts_AccountId",
                table: "CostBudgets");

            migrationBuilder.DropPrimaryKey(
                name: "PK_CostBudgets",
                table: "CostBudgets");

            migrationBuilder.RenameTable(
                name: "CostBudgets",
                newName: "Incomes");

            migrationBuilder.RenameIndex(
                name: "IX_CostBudgets_AccountId",
                table: "Incomes",
                newName: "IX_Incomes_AccountId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Incomes",
                table: "Incomes",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Incomes_Accounts_AccountId",
                table: "Incomes",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Incomes_Accounts_AccountId",
                table: "Incomes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Incomes",
                table: "Incomes");

            migrationBuilder.RenameTable(
                name: "Incomes",
                newName: "CostBudgets");

            migrationBuilder.RenameIndex(
                name: "IX_Incomes_AccountId",
                table: "CostBudgets",
                newName: "IX_CostBudgets_AccountId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_CostBudgets",
                table: "CostBudgets",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_CostBudgets_Accounts_AccountId",
                table: "CostBudgets",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
