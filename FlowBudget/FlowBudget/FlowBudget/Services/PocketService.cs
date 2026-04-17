using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;

namespace FlowBudget.Services;

public class PocketService(ApplicationDbContext db, DailyExpenseService dailyExpenseService)
{
    public async Task<List<PocketDTO>> GetAllPockets(string userId, string divisionPlanId)
    {
        
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var divisionPlan = await db.DivisionPlans.SingleOrDefaultAsync(dp => dp.Id == divisionPlanId);
        if (divisionPlan == null)
        {
            throw new NotFoundException();
        }
        
        // For each pocket lineage (group by OriginalPocketId), pick the version with the
        // highest ActiveFrom that is still within the current-or-past month.
        // Legacy rows where OriginalPocketId IS NULL are treated as their own lineage (self-reference).
        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);

        var allCandidates = await db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id && p.ActiveFrom < firstDayOfNextMonth)
            .ToListAsync();

        return allCandidates
            .GroupBy(p => p.OriginalPocketId ?? p.Id)
            .Select(g => g.OrderByDescending(p => p.ActiveFrom).First())
            .Select(p => new PocketDTO()
            {
                Id = p.Id,
                Name = p.Name,
                Ration = p.Ration,
                DivisionPlanId = p.DivisionPlanId,
            })
            .ToList();
    }

    public async Task<Pocket> AddPocket(string userId, string divisionPlanId, CreatePocketDTO dto, DateTime? allowFrom = null, string? originalPocketId = null)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var divisionPlan = await db.DivisionPlans
            .Include(divisionPlan => divisionPlan.Pockets)
            .SingleOrDefaultAsync(dp => dp.Id == divisionPlanId);
        if (divisionPlan == null) throw new NotFoundException();

        if (user.Accounts.All(a => divisionPlan.AccountId != a.Id))
            throw new UnauthorizedAccessException();

        // Use the exact allowFrom datetime so two edits in the same month get distinct ActiveFrom
        // values and the latest one wins deterministically when versions are compared.
        var effectiveFrom = allowFrom ?? DateTime.Now;

        var pocket = new Pocket
        {
            Name = dto.Name,
            Ration = dto.Ration,
            DivisionPlanId = divisionPlan.Id,
            DivisionPlan = divisionPlan,
            ActiveFrom = effectiveFrom,
        };

        await db.Pockets.AddAsync(pocket);
        await db.SaveChangesAsync();

        // OriginalPocketId is set after save so we can use pocket.Id as the self-reference
        // when this is a brand-new pocket (no prior version exists).
        pocket.OriginalPocketId = originalPocketId ?? pocket.Id;
        await db.SaveChangesAsync();

        // For genuinely new pockets (not version-updates triggered by UpdatePocket):
        // if DEs already exist for the target month (the month was already initiated by
        // other pockets), create DEs for this new pocket immediately so it participates
        // in the current accounting period right away.
        // Version-updates are identified by originalPocketId being provided; UpdatePocket
        // handles DE migration itself in that case.
        if (originalPocketId == null)
        {
            var siblingPocketIds = await db.Pockets
                .Where(p => p.DivisionPlanId == pocket.DivisionPlanId && p.Id != pocket.Id)
                .Select(p => p.Id)
                .ToListAsync();

            var monthAlreadyInitiated = siblingPocketIds.Any()
                && await db.DailyExpenses.AnyAsync(de =>
                    siblingPocketIds.Contains(de.PocketId)
                    && de.Date.Year == effectiveFrom.Year
                    && de.Date.Month == effectiveFrom.Month);

            if (monthAlreadyInitiated)
            {
                var daysInMonth = DateTime.DaysInMonth(effectiveFrom.Year, effectiveFrom.Month);
                var dailyAmount = await dailyExpenseService.CalculateDailyExpenseAmount(
                    divisionPlan.AccountId, pocket.Ration, daysInMonth, effectiveFrom);

                var newDEs = Enumerable.Range(1, daysInMonth)
                    .Select(day => new DailyExpense
                    {
                        Date = new DateTime(effectiveFrom.Year, effectiveFrom.Month, day),
                        StartAmount = dailyAmount,
                        EoDAmount = dailyAmount,
                        PocketId = pocket.Id,
                        Pocket = pocket,
                    })
                    .ToList();

                db.DailyExpenses.AddRange(newDEs);
                await db.SaveChangesAsync();
            }
        }

        return pocket;
    }

    // Creates a new version of the pocket (preserving its lineage via OriginalPocketId).
    // If allowFrom is in a future month no recalculation is done yet.
    // If allowFrom is in the current month, existing daily expenses are re-assigned and recalculated.
    public async Task UpdatePocket(string userId, EditPocketDTO dto, DateTime allowFrom)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }

        var pocket = await db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == dto.Id);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => a.Id != pocket.DivisionPlan.AccountId))
        {
            throw new UnauthorizedAccessException();
        }
        
        if (dto.Ration == null)
        {
            if (dto.Name != null) pocket.Name = dto.Name;
            await db.SaveChangesAsync();
            return;
        }

        // Carry the lineage forward: new version shares the same OriginalPocketId.
        var originalId = pocket.OriginalPocketId ?? pocket.Id;

        var newPocketDto = new CreatePocketDTO()
        {
            Name = dto.Name ?? pocket.Name,
            Ration = dto.Ration ?? pocket.Ration,
        };

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);

        // Future month — create the new version and migrate any pre-generated DEs for that month.
        if (allowFrom >= firstDayOfNextMonth)
        {
            var newDbPocketFuture = await AddPocket(userId, pocket.DivisionPlanId, newPocketDto, allowFrom, originalPocketId: originalId);

            // If the user pre-generated DEs for the future month, migrate them to the new version
            // and recalculate so the updated ration is reflected immediately.
            var futureDEs = await db.DailyExpenses
                .Where(de => de.PocketId == pocket.Id
                             && de.Date.Year == allowFrom.Year
                             && de.Date.Month == allowFrom.Month)
                .ToListAsync();

            if (futureDEs.Any())
            {
                foreach (var de in futureDEs)
                {
                    de.PocketId = newDbPocketFuture.Id;
                    de.Pocket = newDbPocketFuture;
                }
                await db.SaveChangesAsync();

                await dailyExpenseService.RecalculateFullMonth(newDbPocketFuture.Id, allowFrom.Year, allowFrom.Month);
            }

            return;
        }

        // Current month (or past) — create new version and migrate + recalculate daily expenses.
        var newDbPocket = await AddPocket(userId, pocket.DivisionPlanId, newPocketDto, allowFrom, originalPocketId: originalId);

        var dailyExpenses = await db.DailyExpenses
            .Where(de => de.PocketId == pocket.Id
                      && de.Date.Year == allowFrom.Year
                      && de.Date.Month == allowFrom.Month)
            .ToListAsync();

        if (dailyExpenses.Any())
        {
            foreach (var de in dailyExpenses)
            {
                de.PocketId = newDbPocket.Id;
                de.Pocket = newDbPocket;
            }
            await db.SaveChangesAsync();

            var endOfMonth = new DateTime(allowFrom.Year, allowFrom.Month, dailyExpenseService.GetDaysInMonth(allowFrom));
            await dailyExpenseService.RecalculateDailyExpenses(newDbPocket.Id, endOfMonth, activate: false, recalculateFromStart: true);
        }
    }

    public async Task DeletePocket(string userId, string pocketId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var pocket = await db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null) throw new NotFoundException();

        if (user.Accounts.All(a => a.Id != pocket.DivisionPlan.AccountId))
            throw new UnauthorizedAccessException();

        // Collect every version of this pocket's lineage
        var lineageId = pocket.OriginalPocketId ?? pocket.Id;
        var allLineageVersions = await db.Pockets
            .Where(p => (p.OriginalPocketId == lineageId || p.Id == lineageId)
                        && p.DivisionPlanId == pocket.DivisionPlanId)
            .ToListAsync();
        var lineageIds = allLineageVersions.Select(p => p.Id).ToHashSet();

        var now = DateTime.Now;
        var firstDayOfNextMonth = new DateTime(now.Year, now.Month, 1).AddMonths(1);

        // Get current-version sibling pockets (not from the deleted lineage)
        var siblingCandidates = await db.Pockets
            .Where(p => p.DivisionPlanId == pocket.DivisionPlanId
                        && p.ActiveFrom < firstDayOfNextMonth
                        && !lineageIds.Contains(p.Id))
            .ToListAsync();

        var remainingCurrentPockets = siblingCandidates
            .GroupBy(p => p.OriginalPocketId ?? p.Id)
            .Select(g => g.OrderByDescending(p => p.ActiveFrom).First())
            .ToList();

        if (!remainingCurrentPockets.Any())
            throw new InconsistencyException(); // Cannot delete the only pocket in a plan

        // Find the most active remaining pocket (most started DailyExpenses this month)
        var remainingIds = remainingCurrentPockets.Select(p => p.Id).ToList();
        var startedCounts = await db.DailyExpenses
            .Where(de => remainingIds.Contains(de.PocketId)
                         && de.IsStarted
                         && de.Date.Year == now.Year
                         && de.Date.Month == now.Month)
            .GroupBy(de => de.PocketId)
            .Select(g => new { PocketId = g.Key, Count = g.Count() })
            .ToListAsync();

        var targetPocket = startedCounts.Any()
            ? remainingCurrentPockets.First(p => p.Id == startedCounts.OrderByDescending(x => x.Count).First().PocketId)
            : remainingCurrentPockets.First();

        // Add the deleted pocket's (current version) ration to the target
        targetPocket.Ration += pocket.Ration;

        // Migrate all DailyExpenses from every lineage version into the target pocket.
        // We use ExecuteUpdateAsync to move Expenditure FKs so that EF's cascade tracking
        // never sees them as children of the DailyExpenses we are about to delete.
        foreach (var version in allLineageVersions)
        {
            var sourceDEs = await db.DailyExpenses
                .Where(de => de.PocketId == version.Id)
                .ToListAsync(); // loaded WITHOUT Expenditures — intentional

            foreach (var sourceDE in sourceDEs)
            {
                var targetDE = await db.DailyExpenses
                    .FirstOrDefaultAsync(de => de.PocketId == targetPocket.Id
                                               && de.Date.Date == sourceDE.Date.Date);

                if (targetDE != null)
                {
                    // Target already has a DailyExpense for this date.
                    // Move all expenditure references to targetDE at DB level.
                    await db.Expenditures
                        .Where(e => e.DailyExpenseId == sourceDE.Id)
                        .ExecuteUpdateAsync(e => e.SetProperty(x => x.DailyExpenseId, targetDE.Id));

                    // Re-read the sum from DB to include the just-moved expenditures
                    var totalExp = await db.Expenditures
                        .Where(e => e.DailyExpenseId == targetDE.Id)
                        .SumAsync(e => (decimal?)e.Price) ?? 0m;
                    targetDE.EoDAmount = targetDE.StartAmount - totalExp;

                    // sourceDE is now childless in DB — safe to mark for deletion
                    db.DailyExpenses.Remove(sourceDE);
                }
                else
                {
                    // No corresponding target DE: re-point the source DE to the target pocket
                    sourceDE.PocketId = targetPocket.Id;
                    sourceDE.Pocket = targetPocket;
                }
            }
        }

        // Commit: ration update, EoD updates, sourceDE deletions, re-pointed DEs
        await db.SaveChangesAsync();

        // Remove all lineage pocket versions (no DailyExpenses reference them anymore)
        db.Pockets.RemoveRange(allLineageVersions);
        await db.SaveChangesAsync();

        // Recalculate the current month whenever DEs exist (started or not)
        var hasAnyDEsThisMonth = await db.DailyExpenses.AnyAsync(de =>
            de.PocketId == targetPocket.Id
            && de.Date.Year == now.Year
            && de.Date.Month == now.Month);

        if (hasAnyDEsThisMonth)
        {
            await dailyExpenseService.RecalculateFullMonth(targetPocket.Id, now.Year, now.Month);
        }

        // Also recalculate any future months whose DEs were just migrated to the target pocket.
        // These DEs (started or not) need their StartAmount updated to reflect the new combined ration.
        var firstDayOfNextMonthFromNow = new DateTime(now.Year, now.Month, 1).AddMonths(1);
        var futureDates = await db.DailyExpenses
            .Where(de => de.PocketId == targetPocket.Id && de.Date >= firstDayOfNextMonthFromNow)
            .Select(de => de.Date)
            .ToListAsync();

        var futureMonths = futureDates
            .Select(d => new DateTime(d.Year, d.Month, 1))
            .Distinct();

        foreach (var monthStart in futureMonths)
        {
            await dailyExpenseService.RecalculateFullMonth(targetPocket.Id, monthStart.Year, monthStart.Month);
        }
    }
}