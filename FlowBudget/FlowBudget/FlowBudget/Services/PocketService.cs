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
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }

        var divisionPlan = await db.DivisionPlans
            .Include(divisionPlan => divisionPlan.Pockets)
            .SingleOrDefaultAsync(dp => dp.Id == divisionPlanId);
        if (divisionPlan == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => divisionPlan.AccountId != a.Id))
        {
            throw new UnauthorizedAccessException();
        }

        var pocket = new Pocket()
        {
            Name = dto.Name,
            Ration = dto.Ration,
            DivisionPlanId = divisionPlan.Id,
            DivisionPlan = divisionPlan,
        };
        if (allowFrom.HasValue) pocket.ActiveFrom = allowFrom.Value;

        await db.Pockets.AddAsync(pocket);
        await db.SaveChangesAsync();

        // OriginalPocketId is set after save so we can use pocket.Id as the self-reference
        // when this is a brand-new pocket (no prior version exists).
        pocket.OriginalPocketId = originalPocketId ?? pocket.Id;
        await db.SaveChangesAsync();

        return pocket;

        //TODO: into edit only?
        //Recalculate daily expenses for all ACTIVE pockets if
        //a. allowFrom is this month
        //b. they are already started
        // var thisMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);
        // if (allowFrom.Year == thisMonth.Year && allowFrom.Month == thisMonth.Month)
        // {
        //     //Set daily expenses refer to the newly generated pockets instead of the old one?
        //     
        //     var taskList = new List<Task>();
        //     //Then recalculate each pocket for this month
        //     foreach (var p in divisionPlan.Pockets)
        //     {
        //         //Skip this pocket if there are no daily expenses started yet
        //         var anyStarted = await db.DailyExpenses
        //             .Where(de => de.PocketId == p.Id && de.IsStarted)
        //         
        //         if (p.ActiveFrom < allowFrom) continue; //Skip those that are not active yet
        //         taskList.Add(dailyExpenseService.RecalculateDailyExpenses(p.Id, thisMonth, false));
        //     }
        //     
        //     //Execute all at once
        //     await Task.WhenAll(taskList);
        // }
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

        // Name-only change: mutate in place — no versioning needed.
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

        // Future month — just create the new version; nothing to recalculate yet.
        if (allowFrom >= firstDayOfNextMonth)
        {
            await AddPocket(userId, pocket.DivisionPlanId, newPocketDto, allowFrom, originalPocketId: originalId);
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
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var pocket = await db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => a.Id != pocket.DivisionPlan.AccountId))
        {
            throw new UnauthorizedAccessException();
        }
        
        db.Pockets.Remove(pocket);
        await db.SaveChangesAsync();
    }
}