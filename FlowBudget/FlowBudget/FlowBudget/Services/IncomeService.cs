using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class IncomeService(ApplicationDbContext db)
{
    private readonly ApplicationDbContext _db = db;

    public async Task<List<IncomeDTO>> GetAllIncomes(string userId, string accountId)
    {
        var user = await  _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
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
        
        return account.Incomes
            .Select(c => new IncomeDTO()
            {
                Id = c.Id,
                Amount = c.Amount,
                Name = c.Name,
            }).ToList();
    }
    
    public async Task AddIncome(string UserId, CreateIncomeDTO dto)
    {
        var user = await  _db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var account = user.Accounts.SingleOrDefault(a => a.Id == dto.AccountId);
        if (account == null)
        {
            throw new NotFoundException();
        }

        var costBudget = new Income()
        {
            Amount = dto.Amount,
            Name = dto.Name,
            Account = account,
            AccountId = account.Id,
        };
        
        await _db.Incomes.AddAsync(costBudget);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateIncome(string UserId, EditIncomeDTO dto)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var income = await _db.Incomes.SingleOrDefaultAsync(i => i.Id == dto.Id);
        if (income == null)
        {
            throw new NotFoundException();
        }

        if (!user.Accounts.Any(a => a.Incomes.Any(i => i.Id == income.Id)))
        {
            throw new UnauthorizedAccessException();
        }
        
        var anyChange = false;
        if (dto.Amount != null && dto.Amount != income.Amount)
        {
            anyChange = true;
            income.Amount = dto.Amount.Value;
        }

        if (dto.Name != null && dto.Name != income.Name)
        {
            anyChange = true;
            income.Name = dto.Name;
        }

        if (anyChange)
        {
            await _db.SaveChangesAsync();
        }
    }

    public async Task DeleteIncome(string UserId, string IncomeId)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var income = await _db.Incomes.SingleOrDefaultAsync(i => i.Id == IncomeId);
        if (income == null)
        {
            throw new NotFoundException();
        }

        if (!user.Accounts.Any(a => a.Incomes.Any(i => i.Id == income.Id)))
        {
            throw new UnauthorizedAccessException();
        }
        
        _db.Incomes.Remove(income);
        await _db.SaveChangesAsync();
    }
}