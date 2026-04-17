using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class IncomeService(ApplicationDbContext db, DailyExpenseService dailyExpenseService)
{
    public async Task<List<IncomeDTO>> GetAllIncomes(string userId, string accountId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == accountId);
        if (account == null) throw new NotFoundException();

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);

        return account.Incomes
            .Where(i => i.ActiveFrom < firstDayOfNextMonth)
            .GroupBy(i => i.OriginalIncomeId ?? i.Id) //To get the most recent incomes
            .Select(g => g.OrderByDescending(i => i.ActiveFrom).First())
            .Select(i => new IncomeDTO { Id = i.Id, Amount = i.Amount, Name = i.Name })
            .ToList();
    }

    public async Task AddIncome(string userId, CreateIncomeDTO dto)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == dto.AccountId);
        if (account == null) throw new NotFoundException();

        var income = new Income
        {
            Amount = dto.Amount,
            Name = dto.Name,
            Account = account,
            AccountId = account.Id,
        };

        await db.Incomes.AddAsync(income);
        await db.SaveChangesAsync();

        // OriginalIncomeId self-references own Id
        income.OriginalIncomeId = income.Id;
        await db.SaveChangesAsync();

        // Recalculate current month
        await dailyExpenseService.RecalculateAllPocketsForAccount(account.Id, DateTime.Now);
    }
    
    // Amount change: create a new version of the income
    // Recalculate if allowFrom is this month
    public async Task UpdateIncome(string userId, EditIncomeDTO dto, DateTime allowFrom)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var income = await db.Incomes
            .Include(income => income.Account)
            .SingleOrDefaultAsync(i => i.Id == dto.Id);
        if (income == null) throw new NotFoundException();

        if (!user.Accounts.Any(a => a.Incomes.Any(i => i.Id == income.Id)))
            throw new UnauthorizedAccessException();
        
        //Only name is changed
        if (dto.Amount == null)
        {
            if (dto.Name != null) income.Name = dto.Name;
            await db.SaveChangesAsync();
            return;
        }

        //Create a new version — store the exact datetime so two edits in the same month
        //get distinct ActiveFrom values and the latest one wins deterministically.
        var originalId = income.OriginalIncomeId ?? income.Id;

        var newIncome = new Income
        {
            Amount = dto.Amount.Value,
            Name = dto.Name ?? income.Name,
            AccountId = income.AccountId,
            Account = income.Account,
            ActiveFrom = allowFrom,
        };

        await db.Incomes.AddAsync(newIncome);
        await db.SaveChangesAsync();
        newIncome.OriginalIncomeId = originalId;
        await db.SaveChangesAsync();

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);
        if (allowFrom < firstDayOfNextMonth)
        {
            // Current or past month: recalculate this month (the new version is already active)
            await dailyExpenseService.RecalculateAllPocketsForAccount(income.AccountId, DateTime.Now);
        }
        else
        {
            // Future month: only recalculate if DEs were pre-generated for that month
            await dailyExpenseService.RecalculateAllPocketsForAccount(income.AccountId, allowFrom);
        }
    }
    
    public async Task DeleteIncome(string userId, string incomeId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var income = await db.Incomes.SingleOrDefaultAsync(i => i.Id == incomeId);
        if (income == null) throw new NotFoundException();

        if (!user.Accounts.Any(a => a.Incomes.Any(i => i.Id == income.Id)))
            throw new UnauthorizedAccessException();

        var accountId = income.AccountId;

        // Delete every version of this income lineage
        var lineageId = income.OriginalIncomeId ?? income.Id;
        var allVersions = await db.Incomes
            .Where(i => i.AccountId == accountId
                        && (i.OriginalIncomeId == lineageId || i.Id == lineageId))
            .ToListAsync();

        db.Incomes.RemoveRange(allVersions);
        await db.SaveChangesAsync();

        // Removing income reduces available budget → recalculate current month
        await dailyExpenseService.RecalculateAllPocketsForAccount(accountId, DateTime.Now);
    }
}
