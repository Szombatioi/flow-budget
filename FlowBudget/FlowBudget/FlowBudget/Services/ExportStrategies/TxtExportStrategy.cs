using System.Globalization;
using System.Text;
using DTO;
using FlowBudget.Data;

namespace FlowBudget.Services.ExportStrategies;

public class TxtExportStrategy(ApplicationDbContext db) : ExportStrategyBase(db)
{
    public override string Format => "TXT";
    public override string ContentType => "text/plain";
    public override string FileExtension => "txt";

    public override async Task<Stream> ExportAsync(string userId, ExportParameterDTO dto)
    {
        var sep = string.IsNullOrEmpty(dto.Separator) ? "|" : dto.Separator;

        var expenses = await GetExpenditures(userId, dto);

        var memoryStream = new MemoryStream();
        await using (var writer = new StreamWriter(memoryStream, new UTF8Encoding(true), bufferSize: 1024, leaveOpen: true))
        {
            await writer.WriteLineAsync(string.Join(sep, "Date", "Name", "Price", "Currency", "Category", "Description"));
            foreach (var e in expenses)
            {
                await writer.WriteLineAsync(string.Join(sep,
                    e.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    e.Name,
                    e.Price.ToString(CultureInfo.InvariantCulture),
                    dto.CurrencyName,
                    e.Category?.Name ?? "-",
                    e.Description ?? ""));
            }
            await writer.FlushAsync();
        }
        memoryStream.Position = 0;
        return memoryStream;
    }
}
