using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class FixedExpenseService(ApplicationDbContext db, DailyExpenseService dailyExpenseService)
{
    public async Task<List<FixedExpenseDTO>> GetAllFixedExpensesForAccount(string userId, string accountId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == accountId);
        if (account == null) throw new NotFoundException();

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);

        return account.FixedExpenses
            .Where(fe => fe.ActiveFrom < firstDayOfNextMonth)
            .GroupBy(fe => fe.OriginalFixedExpenseId ?? fe.Id) //most active
            .Select(g => g.OrderByDescending(fe => fe.ActiveFrom).First())
            .Select(fe => new FixedExpenseDTO { Id = fe.Id, Amount = fe.Amount, Name = fe.Name })
            .ToList();
    }

    public async Task AddFixExpenditure(string userId, CreateFixedExpenseDTO dto)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == dto.AccountId);
        if (account == null) throw new NotFoundException();

        var fixedExpense = new FixedExpense
        {
            Amount = dto.Amount,
            Name = dto.Name,
            Account = account,
            AccountId = account.Id,
        };

        await db.FixedExpenses.AddAsync(fixedExpense);
        await db.SaveChangesAsync();
        
        fixedExpense.OriginalFixedExpenseId = fixedExpense.Id;
        await db.SaveChangesAsync();

        // recalculate current month
        await dailyExpenseService.RecalculateAllPocketsForAccount(account.Id, DateTime.Now);
    }
    
    public async Task UpdateFixExpenditure(string userId, EditFixedExpenseDTO dto, DateTime allowFrom)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var fixedExpense = await db.FixedExpenses
            .Include(fixedExpense => fixedExpense.Account)
            .SingleOrDefaultAsync(fe => fe.Id == dto.Id);
        if (fixedExpense == null) throw new NotFoundException();

        if (!user.Accounts.Any(a => a.FixedExpenses.Any(fe => fe.Id == fixedExpense.Id)))
            throw new UnauthorizedAccessException();

        //Amount is not changed
        if (dto.Amount == null)
        {
            if (dto.Name != null) fixedExpense.Name = dto.Name;
            await db.SaveChangesAsync();
            return;
        }

        //Create new version
        var originalId = fixedExpense.OriginalFixedExpenseId ?? fixedExpense.Id;
        var allowFromMonth = new DateTime(allowFrom.Year, allowFrom.Month, 1);

        var newFixedExpense = new FixedExpense
        {
            Amount = dto.Amount.Value,
            Name = dto.Name ?? fixedExpense.Name,
            AccountId = fixedExpense.AccountId,
            Account = fixedExpense.Account,
            ActiveFrom = allowFromMonth,
        };

        await db.FixedExpenses.AddAsync(newFixedExpense);
        await db.SaveChangesAsync();
        newFixedExpense.OriginalFixedExpenseId = originalId;
        await db.SaveChangesAsync();

        var firstDayOfNextMonth = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1).AddMonths(1);
        if (allowFromMonth < firstDayOfNextMonth)
        {
            // Current or past month: recalculate this month (the new version is already active)
            await dailyExpenseService.RecalculateAllPocketsForAccount(fixedExpense.AccountId, DateTime.Now);
        }
        else
        {
            // Future month: only recalculate if DEs were pre-generated for that month
            await dailyExpenseService.RecalculateAllPocketsForAccount(fixedExpense.AccountId, allowFromMonth);
        }
    }
    
    public async Task DeleteFixedExpense(string userId, string fixedExpenseId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var fixedExpense = await db.FixedExpenses.SingleOrDefaultAsync(fe => fe.Id == fixedExpenseId);
        if (fixedExpense == null) throw new NotFoundException();

        if (!user.Accounts.Any(a => a.FixedExpenses.Any(fe => fe.Id == fixedExpense.Id)))
            throw new UnauthorizedAccessException();

        var accountId = fixedExpense.AccountId;

        // Delete every version of this fixed expense lineage
        var lineageId = fixedExpense.OriginalFixedExpenseId ?? fixedExpense.Id;
        var allVersions = await db.FixedExpenses
            .Where(fe => fe.AccountId == accountId
                         && (fe.OriginalFixedExpenseId == lineageId || fe.Id == lineageId))
            .ToListAsync();

        db.FixedExpenses.RemoveRange(allVersions);
        await db.SaveChangesAsync();

        // Recalculate current month
        await dailyExpenseService.RecalculateAllPocketsForAccount(accountId, DateTime.Now);
    }
}
