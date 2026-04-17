using AutoMapper;
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class DivisionPlanService(ApplicationDbContext db, IMapper mapper)
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

        var dp = new DivisionPlan
        {
            Account = account,
            AccountId = account.Id,
        };

        await db.DivisionPlans.AddAsync(dp);
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

        // Is there already any active plan for this account
        var hasActivePlan = account.DivisionPlans.Any(dp => dp.IsActive && dp.Id != planId);

        // Cannot activate for the current month when another plan is already active
        if (hasActivePlan && activateFromMonth <= thisMonth)
        {
            throw new InvalidOperationException( //TODO translatable message
                "Another division plan is already active for this account. " +
                "The new plan can only be activated starting from next month.");
        }

        plan.IsActive = true;
        plan.ActiveFrom = activateFromMonth;
        
        //Disable other plans
        // foreach (var dp in account.DivisionPlans.Where(dp => dp.IsActive).ToList())
        // {
        //     dp.IsActive = false;
        // }
        
        await db.SaveChangesAsync();
        
        
        // if (activateFromMonth > thisMonth)
        // {
        //     // Find the plan that was previously active for the activation month
        //     var supersededPlan = account.DivisionPlans
        //         .Where(dp => dp.IsActive && dp.Id != planId && dp.ActiveFrom <= activateFromMonth)
        //         .OrderByDescending(dp => dp.ActiveFrom)
        //         .FirstOrDefault();
        //
        //     if (supersededPlan != null)
        //     {
        //         // Collect all pocket IDs (all versions) belonging to the superseded plan
        //         var supersededPocketIds = await db.Pockets
        //             .Where(p => p.DivisionPlanId == supersededPlan.Id)
        //             .Select(p => p.Id)
        //             .ToListAsync();
        //         
        //         if (supersededPocketIds.Any())
        //         {
        //             await db.DailyExpenses
        //                 .Where(de => supersededPocketIds.Contains(de.PocketId)
        //                              && de.Date.Year == activateFromMonth.Year
        //                              && de.Date.Month == activateFromMonth.Month)
        //                 .ExecuteDeleteAsync();
        //         }
        //     }
        // }
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
