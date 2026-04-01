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
public class AccountService
{
    private readonly ApplicationDbContext _db;

    public AccountService(ApplicationDbContext db)
    {
        _db = db;
    }
    
    public async Task CreateAccount(string UserId, CreateAccountDTO dto)
    {
        //Find user
        var user =  await _db.Users.SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException(); //TODO: handle exception via Middleware
        }

        var currency = await _db.Currencies.SingleOrDefaultAsync(c => c.Code == dto.CurrencyCode);
        if (currency == null)
        {
            throw new NotFoundException();
        }

        var Account = new Account()
        {
            Name =  dto.Name,
            UserId = UserId,
            User = user,
            CurrencyCode = dto.CurrencyCode,
            Currency = currency,
        };
        await _db.Accounts.AddAsync(Account);
        await _db.SaveChangesAsync();
    }

    public async Task<List<AccountDTO>> GetAccounts(string UserId)
    {
        var user  = await _db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == UserId);
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

    public async Task DeleteAccount(string UserId, string AccountId)
    {
        var  user = await _db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var account = user.Accounts.SingleOrDefault(a => a.Id == AccountId);
        if (account == null)
        {
            throw new NotFoundException();
        }
        
        user.Accounts.Remove(account);
        await _db.SaveChangesAsync();
    }
}