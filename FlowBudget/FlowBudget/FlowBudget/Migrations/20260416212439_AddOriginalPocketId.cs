using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class AddOriginalPocketId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OriginalPocketId",
                table: "Pockets",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalPocketId",
                table: "Pockets");
        }
    }
}
