using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FlowBudget.Migrations
{
    /// <inheritdoc />
    public partial class ActiveFromDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ActiveFrom",
                table: "Pockets",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ActiveFrom",
                table: "Incomes",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ActiveFrom",
                table: "FixedExpenses",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "ActiveFrom",
                table: "DivisionPlans",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActiveFrom",
                table: "Pockets");

            migrationBuilder.DropColumn(
                name: "ActiveFrom",
                table: "Incomes");

            migrationBuilder.DropColumn(
                name: "ActiveFrom",
                table: "FixedExpenses");

            migrationBuilder.DropColumn(
                name: "ActiveFrom",
                table: "DivisionPlans");
        }
    }
}
