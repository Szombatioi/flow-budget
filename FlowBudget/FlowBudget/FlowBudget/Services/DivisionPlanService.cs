using AutoMapper;
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class DivisionPlanService(ApplicationDbContext db, IMapper mapper, DailyExpenseService dailyExpenseService)
{
    public async Task Create(string userId, CreateDivisionPlanDTO dto)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == dto.AccountId);
        if (account == null) throw new NotFoundException();

        if (string.IsNullOrWhiteSpace(dto.Name)) throw new InvalidOperationException("field_required");

        var dp = new DivisionPlan
        {
            Account = account,
            AccountId = account.Id,
            Name = dto.Name.Trim(),
            ActiveFrom = new DateTime(1,1,1) //Starting early..
        };

        await db.DivisionPlans.AddAsync(dp);
        await db.SaveChangesAsync();
    }

    public async Task Delete(string userId, string planId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.FirstOrDefault(a => a.DivisionPlans.Any(dp => dp.Id == planId));
        if (account == null) throw new UnauthorizedAccessException();

        var plan = account.DivisionPlans.Single(dp => dp.Id == planId);

        // Prevent removing a plan that has bookkeeping tied to it: if any DailyExpense
        // exists under any of its pockets, deletion would orphan history (and is
        // semantically wrong — the user logged expenses against this plan).
        var hasDailyExpenses = await db.DailyExpenses
            .AnyAsync(de => de.Pocket.DivisionPlanId == planId);
        if (hasDailyExpenses)
            throw new InvalidOperationException("cannot_delete_plan_with_history");

        db.DivisionPlans.Remove(plan);
        await db.SaveChangesAsync();
    }
    
    // Activates a division plan for a given month.
    // If no active plans exist for the account, activation from the current month is allowed.
    // If an active plan already exists, the requested month must be the NEXT month or later,
        // because migrating existing DailyExpenses between plans for the current month is not supported.
    public async Task Activate(string userId, string planId, DateTime activateFrom)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.FirstOrDefault(a => a.DivisionPlans.Any(dp => dp.Id == planId));
        if (account == null) throw new UnauthorizedAccessException();

        var plan = account.DivisionPlans.Single(dp => dp.Id == planId);

        var activateFromMonth = new DateTime(activateFrom.Year, activateFrom.Month, 1);
        var thisMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1);
        
        var hasActivePlan = account.DivisionPlans.Any(dp => dp.IsActive && dp.Id != planId);

        // Cannot activate for the current month when another plan is already active
        if (hasActivePlan && activateFromMonth <= thisMonth)
        {
            throw new InvalidOperationException(
                "Another division plan is already active for this account. " +
                "The new plan can only be activated starting from next month.");
        }
        
        //If the user starts to activate a DP in the future
        //but there are active DEs generated, it cannot be done
        var staleDailyExpenses = await db.DailyExpenses
            .Include(de => de.Pocket).ThenInclude(p => p.DivisionPlan)
            .Include(de => de.Expenditures)
            .Where(de => de.Pocket.DivisionPlan.AccountId == account.Id
                         && de.Pocket.DivisionPlan.Id != planId
                         && de.Date >= activateFromMonth)
            .ToListAsync();
        
        if (staleDailyExpenses.Any(de => de.Expenditures.Any()))
        {
            throw new InvalidOperationException("cannot_activate_with_existing_expenditures");
        }
        if (staleDailyExpenses.Count > 0)
        {
            db.DailyExpenses.RemoveRange(staleDailyExpenses);
        }

        plan.IsActive = true;
        plan.ActiveFrom = activateFromMonth;

        await db.SaveChangesAsync();
        await dailyExpenseService.RecalculateAllPocketsForAccount(account.Id, activateFromMonth);
    }

    public async Task<List<DivisionPlanDTO>> GetAllForAccount(string userId, string accountId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .ThenInclude(pl => pl.Pockets)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == accountId);
        if (account == null) throw new NotFoundException();

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);

        return account.DivisionPlans
            .Select(plan =>
            {
                var dto = mapper.Map<DivisionPlanDTO>(plan);
                
                var activePockets = plan.Pockets
                    .Where(p => p.ActiveFrom < firstDayOfNextMonth)
                    .GroupBy(p => p.OriginalPocketId ?? p.Id)
                    .Select(g => g.OrderByDescending(p => p.ActiveFrom).First())
                    .ToList();

                dto.Pockets = activePockets
                    .Select(p => new PocketDTO
                    {
                        Id = p.Id,
                        Name = p.Name,
                        Ration = p.Ration,
                        DivisionPlanId = p.DivisionPlanId,
                    })
                    .ToList();

                return dto;
            })
            .ToList();
    }
}
