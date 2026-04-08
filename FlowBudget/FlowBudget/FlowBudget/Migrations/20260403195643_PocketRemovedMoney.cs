using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class PocketRemovedMoney : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Money",
                table: "Pockets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Money",
                table: "Pockets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
