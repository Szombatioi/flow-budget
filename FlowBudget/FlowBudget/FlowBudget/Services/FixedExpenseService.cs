// TODO: edit & delete
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class FixedExpenseService(ApplicationDbContext db)
{
    private readonly ApplicationDbContext _db = db;

    public async Task<List<FixedExpenseDTO>> GetAllFixedExpensesForAccount(string userId, string accountId)
    {
        var user = await  _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var account = user.Accounts.SingleOrDefault(a => a.Id == accountId);
        if (account == null)
        {
            throw new NotFoundException();
        }
        
        return account.FixedExpenses
            .Select(c => new FixedExpenseDTO()
            {
                Id = c.Id,
                Amount = c.Amount,
                Name = c.Name,
            }).ToList();
    }
    
    public async Task AddFixExpenditure(string userId, CreateFixedExpenseDTO dto)
    {
        var user = await  _db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var account = user.Accounts.SingleOrDefault(a => a.Id == dto.AccountId);
        if (account == null)
        {
            throw new NotFoundException();
        }
    
        var fixedExpense = new FixedExpense()
        {
            Amount = dto.Amount,
            Name = dto.Name,
            Account = account,
            AccountId = account.Id,
        };
        
        
        await _db.FixedExpenses.AddAsync(fixedExpense);
        await _db.SaveChangesAsync();
    }
    
    public async Task UpdateFixExpenditure(string userId, EditFixedExpenseDTO dto)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var fixedExpense = await _db.FixedExpenses.SingleOrDefaultAsync(i => i.Id == dto.Id);
        if (fixedExpense == null)
        {
            throw new NotFoundException();
        }
    
        if (!user.Accounts.Any(a => a.FixedExpenses.Any(i => i.Id == fixedExpense.Id)))
        {
            throw new UnauthorizedAccessException();
        }
        
        if (dto.Amount != null && dto.Amount != fixedExpense.Amount) fixedExpense.Amount = dto.Amount.Value;
        if (dto.Name != null && dto.Name != fixedExpense.Name) fixedExpense.Name = dto.Name;
        await _db.SaveChangesAsync();
    }
    
    public async Task DeleteFixedExpense(string userId, string fixedExpenseId)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.FixedExpenses)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var fixedExpense = await _db.FixedExpenses.SingleOrDefaultAsync(i => i.Id == fixedExpenseId);
        if (fixedExpense == null)
        {
            throw new NotFoundException();
        }
    
        if (!user.Accounts.Any(a => a.FixedExpenses.Any(i => i.Id == fixedExpense.Id)))
        {
            throw new UnauthorizedAccessException();
        }
        
        _db.FixedExpenses.Remove(fixedExpense);
        await _db.SaveChangesAsync();
    }
}