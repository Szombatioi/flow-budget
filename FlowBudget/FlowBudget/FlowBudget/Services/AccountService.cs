using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

//Account = An financial entity of the User's account
//One user can have multiple financial accounts for their user account
//e.g. Account 1 - General
//     Account 2 - Shared home budgets
public class AccountService(ApplicationDbContext db)
{
    public async Task CreateAccount(string userId, CreateAccountDTO dto)
    {
        //Find user
        var user =  await db.Users.SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException(); //TODO: handle exception via Middleware
        }

        var currency = await db.Currencies.SingleOrDefaultAsync(c => c.Code == dto.CurrencyCode);
        if (currency == null)
        {
            throw new NotFoundException();
        }

        var account = new Account()
        {
            Name =  dto.Name,
            UserId = userId,
            User = user,
            CurrencyCode = dto.CurrencyCode,
            Currency = currency,
        };
        await db.Accounts.AddAsync(account);
        await db.SaveChangesAsync();
    }

    public async Task<List<AccountDTO>> GetAccounts(string userId)
    {
        var user  = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        return user.Accounts
            .Select(a => new AccountDTO()
            {
                Id = a.Id,
                Name = a.Name,
                CurrencyCode = a.CurrencyCode
            }).ToList();
    }

    public async Task UpdateAccount(string userId, string accountId, UpdateAccountDTO dto)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var account = user.Accounts.SingleOrDefault(a => a.Id == accountId);
        if (account == null) throw new NotFoundException();

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("name_required");

        account.Name = dto.Name.Trim();
        await db.SaveChangesAsync();
    }

    public async Task DeleteAccount(string userId, string accountId)
    {
        var  user = await db.Users
            .Include(u => u.Accounts)
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
        
        user.Accounts.Remove(account);
        await db.SaveChangesAsync();
    }
}