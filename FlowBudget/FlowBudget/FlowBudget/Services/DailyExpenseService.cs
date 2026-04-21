using AutoMapper;
using DTO;
using FlowBudget.Client.Components.DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class DailyExpenseService(ApplicationDbContext db, IMapper mapper, LlmHandler llmHandler)
{
    //The date's important attributes are only the year and month
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

        // Find the active division plan for the target month.
        // Among all plans marked IsActive, pick the one with the latest ActiveFrom
        // that is still on or before the first day of the target month.
        var firstDayOfTargetMonth = new DateTime(date.Year, date.Month, 1);
        var divisionPlan = await db.DivisionPlans
            .Include(dp => dp.Pockets)
            .Where(dp => dp.AccountId == accountId && dp.IsActive && dp.ActiveFrom <= firstDayOfTargetMonth)
            .OrderByDescending(dp => dp.ActiveFrom)
            .FirstOrDefaultAsync();

        if (divisionPlan == null)
        {
            throw new InconsistencyException();
        }

        int daysInMonth = GetDaysInMonth(date);
        var existingDailyExpenses = await db.DailyExpenses
            .Where(e => e.Date.Month == date.Month && e.Date.Year == date.Year)
            .ToListAsync();

        //Skip if they are already generated
        if (existingDailyExpenses.Any())
        {
            return;
        }

        //Share the remaining pocket money for the days of the month
        var dailyExpenses = new List<DailyExpense>();

        //Choose those pockets, that are the most active:
            //They are active already in this month
            //But they are not active from the next month or so
        // Include pocket versions created any time within (or before) the target month.
        // Using < firstDayOfNextTargetMonth instead of <= firstDayOfTargetMonth so that
        // mid-month pocket additions/edits (ActiveFrom = e.g. May 15) are included.
        var firstDayOfNextTargetMonth = firstDayOfTargetMonth.AddMonths(1);
        var allPocketsForPlan = await db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id && p.ActiveFrom < firstDayOfNextTargetMonth)
            .ToListAsync();

        var possiblePockets = allPocketsForPlan
            .GroupBy(p => p.OriginalPocketId ?? p.Id)
            .Select(g => g.OrderByDescending(p => p.ActiveFrom).First())
            .ToList();

        foreach(var pocket in possiblePockets)
        {
            //Calculate share between days based on pocket ration
            //TODO: what if this amount is not rounded?
            var dailyExpenseAmount = await CalculateDailyExpenseAmount(divisionPlan.AccountId, pocket.Ration, daysInMonth, date);
            for (int i = 1; i <= daysInMonth; i++)
            {
                var expenseDate = new DateTime(date.Year, date.Month, i);
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

    // Recalculates StartAmount and EoDAmount for DailyExpenses in the given month, up to date.Date.
    // - activate: also marks each processed day as IsStarted.
    // - recalculateFromStart: begin from day 1 instead of the first un-started day.
    //
    // Carryover rule: only propagate EoD from a day that is already IsStarted.
    // This prevents compounding on un-started future-month days (where every day
    // would incorrectly accumulate the previous day's EoDAmount as extra budget).
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
        var requestedDayIndex = dailyExpenses.FindIndex(de => de.Date.Date == date.Date);

        // When recalculateFromStart is true (ration/income/fixed-expense changed), restart from day 1
        // so the new amounts are reflected in every already-started day.
        var startIndex = recalculateFromStart ? 0 : lastStartedIndex + 1;

        var dailyExpenseAmount = await CalculateDailyExpenseAmount(
            pocket.DivisionPlan.AccountId, pocket.Ration, GetDaysInMonth(date), date);

        for (int i = startIndex; i <= requestedDayIndex; i++)
        {
            if (activate) dailyExpenses[i].IsStarted = true;

            dailyExpenses[i].StartAmount = dailyExpenseAmount;

            // Only carry EoD from the immediately preceding day if that day has been started
            // (i.e., it is a settled day). Un-started future days don't carry over, preventing
            // the StartAmount from compounding across days that haven't happened yet.
            decimal eod = (i > 0 && dailyExpenses[i - 1].IsStarted)
                ? dailyExpenses[i - 1].EoDAmount
                : 0m;
            dailyExpenses[i].StartAmount += eod;
            dailyExpenses[i].EoDAmount = dailyExpenses[i].StartAmount - dailyExpenses[i].Expenditures.Sum(e => e.Price);
        }

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Recalculates all currently-active pockets for an account for the given month.
    /// Triggers recalculation even for months where no days are started yet (pre-generated future months).
    /// Called after income, fixed-expense, or pocket ration changes.
    /// </summary>
    public async Task RecalculateAllPocketsForAccount(string accountId, DateTime date)
    {
        var firstDayOfMonth = new DateTime(date.Year, date.Month, 1);
        var firstDayOfNextMonth = firstDayOfMonth.AddMonths(1);
        // Always recalculate up to the last day so all days in the month are covered
        var lastDayOfMonth = firstDayOfNextMonth.AddDays(-1);

        // Find the active division plan for this month (latest ActiveFrom <= first of month)
        var divisionPlan = await db.DivisionPlans
            .Where(dp => dp.AccountId == accountId && dp.IsActive && dp.ActiveFrom <= firstDayOfMonth)
            .OrderByDescending(dp => dp.ActiveFrom)
            .FirstOrDefaultAsync();

        if (divisionPlan == null) return; // No active plan, nothing to recalculate
        
        // Get the pocket version active in the target month: any version created
        // before the start of the following month counts, so mid-month edits are included.
        var allPockets = await db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id && p.ActiveFrom < firstDayOfNextMonth)
            .ToListAsync();

        var currentPockets = allPockets
            .GroupBy(p => p.OriginalPocketId ?? p.Id)
            .Select(g => g.OrderByDescending(p => p.ActiveFrom).First())
            .ToList();

        foreach (var pocket in currentPockets)
        {
            // Recalculate whenever DEs exist for this month — started or not.
            // This handles both live months (some days started) and pre-generated future months.
            var hasAnyDEs = await db.DailyExpenses.AnyAsync(de =>
                de.PocketId == pocket.Id
                && de.Date.Year == date.Year
                && de.Date.Month == date.Month);

            if (hasAnyDEs)
            {
                await RecalculateDailyExpenses(pocket.Id, lastDayOfMonth, activate: false, recalculateFromStart: true);
            }
        }
    }

    /// <summary>
    /// Convenience wrapper: recalculates all DEs for a single pocket for an entire month
    /// (from day 1 through the last day), without activating any days.
    /// </summary>
    public async Task RecalculateFullMonth(string pocketId, int year, int month)
    {
        var lastDay = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        await RecalculateDailyExpenses(pocketId, lastDay, activate: false, recalculateFromStart: true);
    }

    /// <summary>
    /// Calculates the daily budget for a pocket in a specific month.
    /// Uses the income and fixed-expense versions that were active at the start of <paramref name="forMonth"/>,
    /// so future-month pre-generation uses the correct scheduled amounts.
    /// </summary>
    public async Task<decimal> CalculateDailyExpenseAmount(string accountId, double ration, int daysInMonth, DateTime forMonth)
    {
        var firstDayOfTargetMonth = new DateTime(forMonth.Year, forMonth.Month, 1);
        // Use < firstDayOfNextTargetMonth so that mid-month edits (ActiveFrom = e.g. May 15)
        // are included when calculating for that same month.  This replaces the old
        // <= firstDayOfTargetMonth which missed any version created after the 1st.
        var firstDayOfNextTargetMonth = firstDayOfTargetMonth.AddMonths(1);

        // Resolve the income version active at the start of the target month
        var allIncomes = await db.Incomes
            .Where(i => i.AccountId == accountId && i.ActiveFrom < firstDayOfNextTargetMonth)
            .ToListAsync();
        var sumOfIncomes = allIncomes
            .AsEnumerable()
            .GroupBy(i => i.OriginalIncomeId ?? i.Id)
            .Select(g => g.OrderByDescending(i => i.ActiveFrom).First())
            .Sum(i => i.Amount);

        // Resolve the fixed-expense version active at the start of the target month
        var allFixedExpenses = await db.FixedExpenses
            .Where(fe => fe.AccountId == accountId && fe.ActiveFrom < firstDayOfNextTargetMonth)
            .ToListAsync();
        var sumOfFixedExpenses = allFixedExpenses
            .GroupBy(fe => fe.OriginalFixedExpenseId ?? fe.Id)
            .Select(g => g.OrderByDescending(fe => fe.ActiveFrom).First())
            .Sum(fe => fe.Amount);

        var remainingMoney = sumOfIncomes - sumOfFixedExpenses;
        return (remainingMoney * (decimal)ration / 100) / daysInMonth;
    }

    /// <summary>
    /// Cascades a change in one day's EoD forward through all subsequent started days in the month.
    /// Call this after adding or removing an expenditure on <paramref name="fromDate"/> once the
    /// EoDAmount of that day has already been persisted — this method only touches the days AFTER it.
    ///
    /// Stops at the last started day: un-started days are intentionally skipped and will be
    /// corrected naturally when the user opens them (RecalculateDailyExpenses with activate:true).
    /// </summary>
    public async Task RecalculateStartedDaysFromDate(string pocketId, DateTime fromDate)
    {
        var dailyExpenses = await db.DailyExpenses
            .Include(de => de.Expenditures)
            .Where(de => de.PocketId == pocketId
                         && de.Date.Month == fromDate.Month
                         && de.Date.Year == fromDate.Year)
            .OrderBy(de => de.Date)
            .ToListAsync();

        var fromIndex = dailyExpenses.FindIndex(de => de.Date.Date == fromDate.Date);
        var lastStartedIndex = dailyExpenses.FindLastIndex(de => de.IsStarted);

        // Nothing to cascade if the affected day is the last started day (or not found)
        if (fromIndex < 0 || fromIndex >= lastStartedIndex)
            return;

        var pocket = await db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null) throw new NotFoundException();

        var dailyAmount = await CalculateDailyExpenseAmount(
            pocket.DivisionPlan.AccountId, pocket.Ration, GetDaysInMonth(fromDate), fromDate);

        for (int i = fromIndex + 1; i <= lastStartedIndex; i++)
        {
            decimal carryover = dailyExpenses[i - 1].IsStarted ? dailyExpenses[i - 1].EoDAmount : 0m;
            dailyExpenses[i].StartAmount = dailyAmount + carryover;
            dailyExpenses[i].EoDAmount = dailyExpenses[i].StartAmount
                                         - dailyExpenses[i].Expenditures.Sum(e => e.Price);
        }

        await db.SaveChangesAsync();
    }

    public int GetDaysInMonth(DateTime date)
    {
        return DateTime.DaysInMonth(date.Year, date.Month);
    }


    public async Task<List<ExpenditureReceiptItemDTO>> UploadReceipt(string userId, string pocketId, IFormFile file)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        //Get api key for user
        if (user.ApiKey == null)
        {
            throw new UnauthorizedAccessException("no_api_key");
        }
        
        //Get preferred language for user from their settings
        var language = "English";
        
        //Get available categories
        var categories = await db.Categories
            .Include(c => c.User)
            .Where(c => c.UserId == null || c.UserId == userId)
            .Select(c => new CategoryHeaderDTO()
            {
                Id = c.Id,
                Name = c.Name,
            })
            .ToListAsync();
        
        //Upload receipt to AI
        var result = await llmHandler.UploadReceipt<List<ExpenditureReceiptItemDTO>>(language, categories, user.ApiKey, file);
        return result;
    }
}
