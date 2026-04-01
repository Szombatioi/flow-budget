using System.Globalization;
using DTO;
using FlowBudget.Data;
using FlowBudget.Services.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class UserService
{
    private readonly ApplicationDbContext _db;

    public UserService(ApplicationDbContext db)
    {
        _db = db;
    }
    public async Task<UserBaseDTO> Get(string UserId)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
        {
            throw new NotFoundException();
        }

        return new UserBaseDTO()
        {
            Id = user.Id,
            AccountIds = user.Accounts.Select(a => a.Id).ToList(),
        };
    }
}