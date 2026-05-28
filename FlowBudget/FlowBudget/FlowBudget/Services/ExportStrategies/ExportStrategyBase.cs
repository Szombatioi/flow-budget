using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services.ExportStrategies;

public abstract class ExportStrategyBase(ApplicationDbContext db) : IExportStrategy
{
    public abstract string Format { get; }
    public abstract string ContentType { get; }
    public abstract string FileExtension { get; }

    public abstract Task<Stream> ExportAsync(string userId, ExportParameterDTO dto);

    protected async Task<List<Expenditure>> GetExpenditures(string userId, ExportParameterDTO dto)
    {
        var categoryIds = dto.Categories.Select(c => c.Id).ToList();
        var pocketIds = dto.Pockets.Select(p => p.Id).ToList();

        return await db.Expenditures
            .Include(e => e.DailyExpense)
            .ThenInclude(de => de.Pocket)
            .ThenInclude(p => p.DivisionPlan)
            .ThenInclude(dp => dp.Account)
            .Include(e => e.Category)
            .Where(e =>
                e.DailyExpense.Pocket.DivisionPlan.Account.UserId == userId &&
                e.Date >= dto.FromDate &&
                e.Date <= dto.ToDate &&
                (categoryIds.Count == 0 || (e.CategoryId != null && categoryIds.Contains(e.CategoryId))) &&
                (pocketIds.Count == 0 || pocketIds.Contains(e.DailyExpense.PocketId)))
            .OrderBy(e => e.Date)
            .ThenBy(e => e.Name)
            .ThenBy(e => e.CategoryId)
            .ToListAsync();
    }
}