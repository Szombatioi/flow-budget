using ClosedXML.Excel;
using DTO;
using FlowBudget.Data;

namespace FlowBudget.Services.ExportStrategies;

public class ExcelExportStrategy(ApplicationDbContext db) : ExportStrategyBase(db)
{
    public override string Format => "EXCEL";
    public override string ContentType => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public override string FileExtension => "xlsx";

    public override async Task<Stream> ExportAsync(string userId, ExportParameterDTO dto)
    {
        var expenses = await GetExpenditures(userId, dto);

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Expenditures");

        // Header
        sheet.Cell(1, 1).Value = "Date";
        sheet.Cell(1, 2).Value = "Name";
        sheet.Cell(1, 3).Value = "Price";
        sheet.Cell(1, 4).Value = "Currency";
        sheet.Cell(1, 5).Value = "Category";
        sheet.Cell(1, 6).Value = "Description";

        var headerRow = sheet.Row(1);
        headerRow.Style.Font.Bold = true;
        headerRow.Style.Fill.BackgroundColor = XLColor.LightGray;

        var row = 2;
        foreach (var e in expenses)
        {
            sheet.Cell(row, 1).Value = e.Date;
            sheet.Cell(row, 1).Style.DateFormat.Format = "yyyy-MM-dd";
            sheet.Cell(row, 2).Value = e.Name;
            // Price as a real number so the column can be summed/formatted in Excel.
            sheet.Cell(row, 3).Value = e.Price;
            sheet.Cell(row, 4).Value = dto.CurrencyName;
            sheet.Cell(row, 5).Value = e.Category?.Name ?? "-";
            sheet.Cell(row, 6).Value = e.Description;
            row++;
        }

        sheet.Columns().AdjustToContents();
        
        var memoryStream = new MemoryStream();
        workbook.SaveAs(memoryStream);
        memoryStream.Position = 0;
        return memoryStream;
    }
}
