using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class PocketService(ApplicationDbContext db)
{
    private readonly ApplicationDbContext _db = db;

    public async Task<List<PocketDTO>> GetAllPockets(string userId, string divisionPlanId)
    {
        
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var divisionPlan = await _db.DivisionPlans.SingleOrDefaultAsync(dp => dp.Id == divisionPlanId);
        if (divisionPlan == null)
        {
            throw new NotFoundException();
        }
        return await _db.Pockets
            .Where(p => p.DivisionPlanId == divisionPlan.Id)
            .Select(p => new PocketDTO()
            {
                Id =  p.Id,
                Name = p.Name,
                // Money = p.Money,
                Ration = p.Ration * 100,
                DivisionPlanId = p.DivisionPlanId,
            })
            .ToListAsync();
    }

    public async Task AddPocket(string userId, string divisionPlanId, CreatePocketDTO dto)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var divisionPlan = await _db.DivisionPlans.SingleOrDefaultAsync(dp => dp.Id == divisionPlanId);
        if (divisionPlan == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => divisionPlan.AccountId != a.Id))
        {
            throw new UnauthorizedAccessException();
        }

        var pocket = new Pocket()
        {
            Name = dto.Name,
            // Money = dto.Money,
            Ration = dto.Ration,
            DivisionPlanId = divisionPlan.Id,
            DivisionPlan = divisionPlan,
        };
        
        await _db.Pockets.AddAsync(pocket);
        await _db.SaveChangesAsync();
    }

    public async Task UpdatePocket(string userId, EditPocketDTO dto)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var pocket = await _db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == dto.Id);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => a.Id != pocket.DivisionPlan.AccountId))
        {
            throw new UnauthorizedAccessException();
        }
        
        if(dto.Name != null && dto.Name != pocket.Name) pocket.Name = dto.Name;
        // if(dto.Money != null && dto.Money.Value != pocket.Money) pocket.Money = dto.Money.Value;
        if (dto.Ration != null && Math.Abs(dto.Ration.Value - pocket.Ration) > 0.01) pocket.Ration = dto.Ration.Value;
        await _db.SaveChangesAsync();
    }

    public async Task DeletePocket(string userId, string pocketId)
    {
        var user = await _db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.Incomes)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }
        
        var pocket = await _db.Pockets
            .Include(p => p.DivisionPlan)
            .SingleOrDefaultAsync(p => p.Id == pocketId);
        if (pocket == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a => a.Id != pocket.DivisionPlan.AccountId))
        {
            throw new UnauthorizedAccessException();
        }
        
        _db.Pockets.Remove(pocket);
        await _db.SaveChangesAsync();
    }
}