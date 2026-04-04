using AutoMapper;
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class DivisionPlanService(ApplicationDbContext db, IMapper mapper)
{
    private readonly ApplicationDbContext _db = db;
    private readonly IMapper _mapper = mapper;

    public async Task Create(string userId, CreateDivisionPlanDTO dto)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
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

        var dp = new DivisionPlan()
        {
            Account = account,
            AccountId = account.Id,
        };
        
        await _db.DivisionPlans.AddAsync(dp);
        await _db.SaveChangesAsync();
    }

    public async Task<List<DivisionPlanDTO>> GetAllForAccount(string userId, string accountId)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .ThenInclude(pl => pl.Pockets)
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
        
        return account.DivisionPlans
            .Select(p => _mapper.Map<DivisionPlanDTO>(p))
            .ToList();
    }
}