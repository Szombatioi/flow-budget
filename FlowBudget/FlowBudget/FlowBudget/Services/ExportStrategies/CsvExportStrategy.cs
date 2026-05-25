using System.Globalization;
using System.Text;
using DTO;
using FlowBudget.Data;

namespace FlowBudget.Services.ExportStrategies;

public class CsvExportStrategy(ApplicationDbContext db) : ExportStrategyBase(db)
{
    public override string Format => "CSV";
    public override string ContentType => "text/csv";
    public override string FileExtension => "csv";

    public override async Task<Stream> ExportAsync(string userId, ExportParameterDTO dto)
    {
        var expenses = await GetExpenditures(userId, dto);

        var memoryStream = new MemoryStream();
        await using (var writer = new StreamWriter(memoryStream, new UTF8Encoding(true), bufferSize: 1024, leaveOpen: true))
        {
            await writer.WriteLineAsync("Date,Name,Price,Currency,Category,Description");
            foreach (var e in expenses)
            {
                await writer.WriteLineAsync(string.Join(",",
                    e.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    Escape(e.Name),
                    e.Price.ToString(CultureInfo.InvariantCulture),
                    Escape(dto.CurrencyName),
                    Escape(e.Category?.Name ?? "-"),
                    Escape(e.Description)));
            }
            await writer.FlushAsync();
        }
        memoryStream.Position = 0;
        return memoryStream;
    }

    private static string Escape(string? s) =>
        s is null ? "" :
        s.Contains(',') || s.Contains('"') || s.Contains('\n')
            ? "\"" + s.Replace("\"", "\"\"") + "\""
            : s;
}
