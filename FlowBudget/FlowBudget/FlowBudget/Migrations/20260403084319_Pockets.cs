using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class Pockets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets");

            migrationBuilder.DropForeignKey(
                name: "FK_Pockets_DivisionPlans_DivisionPlanId",
                table: "Pockets");

            migrationBuilder.AlterColumn<string>(
                name: "DivisionPlanId",
                table: "Pockets",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AccountId",
                table: "Pockets",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Pockets",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Pockets_DivisionPlans_DivisionPlanId",
                table: "Pockets",
                column: "DivisionPlanId",
                principalTable: "DivisionPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets");

            migrationBuilder.DropForeignKey(
                name: "FK_Pockets_DivisionPlans_DivisionPlanId",
                table: "Pockets");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Pockets");

            migrationBuilder.AlterColumn<string>(
                name: "DivisionPlanId",
                table: "Pockets",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AlterColumn<string>(
                name: "AccountId",
                table: "Pockets",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Pockets_Accounts_AccountId",
                table: "Pockets",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Pockets_DivisionPlans_DivisionPlanId",
                table: "Pockets",
                column: "DivisionPlanId",
                principalTable: "DivisionPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
