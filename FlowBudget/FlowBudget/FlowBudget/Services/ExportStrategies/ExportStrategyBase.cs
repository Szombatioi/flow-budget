using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services.ExportStrategies;

public abstract class ExportStrategyBase(ApplicationDbContext db) : IExportStrategy
{
    // Each concrete strategy must declare what format identifier it handles
    // and what MIME / extension to use for the HTTP response.
    public abstract string Format { get; }
    public abstract string ContentType { get; }
    public abstract string FileExtension { get; }

    public abstract Task<Stream> ExportAsync(string userId, ExportParameterDTO dto);

    /// <summary>
    /// User-scoped query for expenditures matching the export parameters.
    /// An empty Categories / Pockets list means "no filter on that axis"
    /// (matches the front-end's "All" pre-selection semantics).
    /// </summary>
    protected async Task<List<Expenditure>> GetExpenditures(string userId, ExportParameterDTO dto)
    {
        // Materialize the IDs once so EF translates them as a SQL IN parameter list
        // instead of trying to translate the DTO objects inside the expression tree.
        var categoryIds = dto.Categories.Select(c => c.Id).ToList();
        var pocketIds = dto.Pockets.Select(p => p.Id).ToList();

        return await db.Expenditures
            .Include(e => e.DailyExpense)
            .ThenInclude(de => de.Pocket)
            .ThenInclude(p => p.DivisionPlan)
            .ThenInclude(dp => dp.Account)
            .Include(e => e.Category)
            .Where(e =>
                // Security: only the requesting user's expenditures.
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
