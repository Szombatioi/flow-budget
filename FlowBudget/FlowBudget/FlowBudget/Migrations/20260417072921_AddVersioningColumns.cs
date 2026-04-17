using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class AddVersioningColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OriginalIncomeId",
                table: "Incomes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginalFixedExpenseId",
                table: "FixedExpenses",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalIncomeId",
                table: "Incomes");

            migrationBuilder.DropColumn(
                name: "OriginalFixedExpenseId",
                table: "FixedExpenses");
        }
    }
}
