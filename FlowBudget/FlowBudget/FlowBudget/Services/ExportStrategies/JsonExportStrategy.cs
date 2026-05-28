using System.Text.Json;
using DTO;
using FlowBudget.Data;

namespace FlowBudget.Services.ExportStrategies;

public class JsonExportStrategy(ApplicationDbContext db) : ExportStrategyBase(db)
{
    public override string Format => "JSON";
    public override string ContentType => "application/json";
    public override string FileExtension => "json";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = null
    };

    public override async Task<Stream> ExportAsync(string userId, ExportParameterDTO dto)
    {
        var expenses = await GetExpenditures(userId, dto);
        
        var projected = expenses.Select(e => new
        {
            Date = e.Date.ToString("yyyy-MM-dd"),
            e.Name,
            e.Price,
            Currency = dto.CurrencyName,
            Category = e.Category?.Name ?? "-",
            e.Description
        });

        var memoryStream = new MemoryStream();
        await JsonSerializer.SerializeAsync(memoryStream, projected, JsonOptions);
        memoryStream.Position = 0;
        return memoryStream;
    }
}
