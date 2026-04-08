using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryToExpenditure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryId",
                table: "Expenditures",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenditures_CategoryId",
                table: "Expenditures",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenditures_Categories_CategoryId",
                table: "Expenditures",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenditures_Categories_CategoryId",
                table: "Expenditures");

            migrationBuilder.DropIndex(
                name: "IX_Expenditures_CategoryId",
                table: "Expenditures");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Expenditures");
        }
    }
}
