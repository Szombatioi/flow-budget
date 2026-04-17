using AutoMapper;
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class DailyExpenseService(ApplicationDbContext db, IMapper mapper)
{
    //The date's important attributes are only the year and month
    //If all daily expenses are already created, it throws an exception
    //Flow logic:
        //We handle accounts, since all account has one and only one active divisionPlan
        //Get incomes, sum them
        //Get fixed expenses, subtract from incomes
        //Get pockets of the active division plan, we will create a daily expense for each
        //Share the remaining pocket money for the days of the month
    public async Task CreateDailyExpenseForMonth(string userId, string accountId, DateTime date)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var account = await db.Accounts.SingleOrDefaultAsync(a => a.Id == accountId);
        if (account == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => a.Id != accountId))
        {
            throw new UnauthorizedAccessException();
        }
        
        //Find active division plan
        var divisionPlans = await db.DivisionPlans
            .Include(dp => dp.Pockets)
            .Where(p => p.AccountId == accountId && p.IsActive)
            .ToListAsync();
        if (divisionPlans.Count == 0)
        {
            throw new InconsistencyException(); //TODO: message
        }

        if (divisionPlans.Count > 1)
        {
            throw new InconsistencyException(); //TODO: message
        }
        var divisionPlan = divisionPlans.Single();
        
        int daysInMonth = GetDaysInMonth(date);
        var existingDailyExpenses = await db.DailyExpenses
            .Where(e => e.Date.Date.Month == date.Date.Month && e.Date.Date.Year == date.Date.Year)
            .ToListAsync();
        
        //Skip if they are already generated
        if (existingDailyExpenses.Any())
        {
            return;
        }
        
        //Share the remaining pocket money for the days of the month
        var dailyExpenses = new List<DailyExpense>();
        
        var today = DateTime.Today;
        var maxActiveFrom = db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id && p.ActiveFrom <= today)
            .Max(p => p.ActiveFrom);

         var possiblePockets = await db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id && p.ActiveFrom == maxActiveFrom)
            .ToListAsync();
         
        foreach(var pocket in possiblePockets)
        {
            //Calculate share between days based on pocket ration
            //TODO: what if this amount is not rounded?
            var dailyExpenseAmount = await CalculateDailyExpenseAmount(divisionPlan.AccountId, pocket.Ration, daysInMonth);
            // var dailyExpenseAmount = (remainingMoney * (decimal)pocket.Ration / 100) / daysInMonth; //e.g. 300.000 * 0.25
            for (int i = 1; i <= daysInMonth; i++)
            {
                //Skip if already present
                var expenseDate = new DateTime(date.Year, date.Month, i);
                
                //Check if the daily expense is already generated
                // if (existingDailyExpenses[i].Date == date) continue;
                dailyExpenses.Add(new DailyExpense()
                {
                     Date = expenseDate,
                     StartAmount = dailyExpenseAmount,
                     EoDAmount = dailyExpenseAmount,
                     PocketId = pocket.Id,
                     Pocket = pocket,
                });
            }
        }
        db.DailyExpenses.AddRange(dailyExpenses);
        await db.SaveChangesAsync();
    }

    //Additional logic: If we load a daily expense for a given day, 
    //we check if the day is started already.
    //If it is not, find the last started day in this month and start each day between.
    //Starting each day:
        //Setting flag
        //Getting EoD from the previous day
            //If yesterday's EoD is positive, next day StartAmount will be more :)
            //If yesterday's EoD is negative, you'll need to spend less the next day :(
    public async Task<DailyExpenseDTO> GetDailyExpense(string userId, string pocketId, DateTime date)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .ThenInclude(dp => dp.Pockets)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var pocket = await db.Pockets
            .Include(pocket => pocket.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        //This is a bit complex, but...
        //the user has no right to access, if neither of their accounts
            //have any division plans that
                //has a pocket with this ID
        if (user.Accounts.All(a => a.DivisionPlans.All(dp => dp.Pockets.All(p => p.Id != pocketId))))
        {
            throw new UnauthorizedAccessException();
        }
        
        var dailyExpense = await db.DailyExpenses
            .Include(de => de.Expenditures)
            .Include(de => de.Pocket)
            .ThenInclude(p => p.DivisionPlan)
            .ThenInclude(p => p.Account)
            .SingleOrDefaultAsync(de => de.PocketId == pocket.Id && de.Date.Date == date.Date);
        if (dailyExpense == null)
        {
            //Not found, so create it for the whole month
            await CreateDailyExpenseForMonth(userId, pocket.DivisionPlan.AccountId, date);
            return await GetDailyExpense(userId, pocket.Id, date); //retry logic
        }

        if (!dailyExpense.IsStarted)
        {
            await RecalculateDailyExpenses(pocket.Id, date, activate: true);
            var updated = await db.DailyExpenses.SingleOrDefaultAsync(e => e.Date.Date == date.Date && e.PocketId == pocket.Id);
            return mapper.Map<DailyExpenseDTO>(updated);
        }
        return mapper.Map<DailyExpenseDTO>(dailyExpense);
    }

    //Recalculating all daily expenses (StartAmount and EoD) in a month
    //Activate bool = should it activate the daily expenses as well?
    public async Task RecalculateDailyExpenses(string pocketId, DateTime date, bool activate = false, bool recalculateFromStart = false)
    {
        var dailyExpenses = await db.DailyExpenses
            .Include(de => de.Expenditures)
            .Where(de => de.PocketId == pocketId
                         && de.Date.Month == date.Month
                         && de.Date.Year == date.Year)
            .OrderBy(de => de.Date)
            .ToListAsync();
        
        var pocket = await db.Pockets
            .Include(p => p.DivisionPlan)
            .ThenInclude(p => p.Account)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        var lastStartedIndex = dailyExpenses.FindLastIndex(de => de.IsStarted);
        // if (lastStartedIndex == -1) return;

        var requestedDayIndex = dailyExpenses.FindIndex(de => de.Date.Date == date.Date);
        
        // When recalculateFromStart is true (pocket ration changed), restart from day 1
        // so the new ration is reflected in every already-started day's StartAmount
        var startIndex = recalculateFromStart ? 0 : lastStartedIndex + 1;
        
        var dailyExpenseAmount = await CalculateDailyExpenseAmount(pocket.DivisionPlan.AccountId, pocket.Ration, GetDaysInMonth(date.Date));
        
        for (int i = startIndex; i <= requestedDayIndex; i++)
        {
            if(activate) dailyExpenses[i].IsStarted = true;
            
            //Update: we should find out the ration of the pocket, because PocketService can call this too...
            //When the rations are modified, all StartAmounts should be recalculated from zero...
            dailyExpenses[i].StartAmount = dailyExpenseAmount;

            decimal eod = i > 0 ? dailyExpenses[i - 1].EoDAmount : 0;
            dailyExpenses[i].StartAmount += eod;
            dailyExpenses[i].EoDAmount = dailyExpenses[i].StartAmount - dailyExpenses[i].Expenditures.Sum(e => e.Price);
        }

        await db.SaveChangesAsync();

        // return dailyExpenses[requestedDayIndex];
    }

    public async Task<decimal> CalculateDailyExpenseAmount(string accountId, double ration, int daysInMonth)
    {
        //Get incomes, sum them
        var incomes = await db.Incomes
            .Where(i => i.AccountId == accountId)
            .ToListAsync();
        var sumOfIncomes = incomes.Sum(i => i.Amount);
        
        //Get fixed expenses, subtract from incomes
        var fixedExpenses = await db.FixedExpenses
            .Where(fe => fe.AccountId == accountId)
            .ToListAsync();
        var sumOfFixedExpenses = fixedExpenses.Sum(fe => fe.Amount);
        
        //Get pockets of the active division plan, we will create a daily expense for each
        //var pockets = divisionPlan.Pockets;
        
        var remainingMoney = sumOfIncomes - sumOfFixedExpenses;
        
        return (remainingMoney * (decimal)ration / 100) / daysInMonth; //e.g. 300.000 * 0.25
    }

    public int GetDaysInMonth(DateTime date)
    {
        return DateTime.DaysInMonth(date.Year, date.Month);
    }
    
}