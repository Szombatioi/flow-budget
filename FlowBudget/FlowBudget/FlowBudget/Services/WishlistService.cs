using AutoMapper;
using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class WishlistService(ApplicationDbContext db, IMapper mapper)
{
    public async Task<WishlistDTO> Create(string userId, CreateWishlistDTO dto)
    {
        var account = await db.Accounts.SingleOrDefaultAsync(a => a.Id == dto.AccountId && a.UserId == userId)
                      ?? throw new NotFoundException();

        if (dto.ApproachType == WishlistApproachType.Automatic && dto.AffectedDailyExpenseIds.Count > 0)
        {
            var alreadyTaken = await db.DailyExpenses
                .Where(de => dto.AffectedDailyExpenseIds.Contains(de.Id) && de.WishlistId != null)
                .Select(de => de.Id)
                .ToListAsync();
            if (alreadyTaken.Count > 0)
                throw new InvalidOperationException(
                    "One or more daily expenses are already referenced by another wishlist.");
        }

        var wishlist = new Wishlist
        {
            Name = dto.Name,
            Description = dto.Description,
            ImageUrl = dto.ImageUrl,
            Goal = dto.TargetAmount,
            TargetDate = dto.TargetDate,
            Mode = dto.ApproachType,
            AccountId = account.Id,
            Status = WishlistStatus.Inactive
        };
        db.Wishlists.Add(wishlist);
        await db.SaveChangesAsync();

        if (dto.ApproachType == WishlistApproachType.Automatic && dto.AffectedDailyExpenseIds.Count > 0)
        {
            var des = await db.DailyExpenses
                .Where(de => dto.AffectedDailyExpenseIds.Contains(de.Id))
                .ToListAsync();
            foreach (var de in des) de.WishlistId = wishlist.Id;
            await db.SaveChangesAsync();
        }

        return await Get(userId, wishlist.Id);
    }

    public async Task<List<WishlistDTO>> GetAll(string userId)
    {
        var entities = await db.Wishlists
            .Include(w => w.Account)
            .Include(w => w.Progress)
            .Where(w => w.Account.UserId == userId)
            .ToListAsync();

        var result = mapper.Map<List<WishlistDTO>>(entities);
        for (var i = 0; i < entities.Count; i++)
            result[i].Status = entities[i].Status;
        return result;
    }

    public async Task<WishlistDTO> Get(string userId, string wishlistId)
    {
        var entity = await db.Wishlists
            .Include(w => w.Account)
            .Include(w => w.Progress)
            .Include(w => w.AffectedDailyExpenses)
            .SingleOrDefaultAsync(w => w.Id == wishlistId && w.Account.UserId == userId)
            ?? throw new NotFoundException();

        var dto = mapper.Map<WishlistDTO>(entity);
        dto.Status = entity.Status;
        return dto;
    }

    public async Task MoveMoneyToWishlist(string userId, string pocketId, string wishlistId, MoveMoneyDTO dto, bool saveImmediately = true)
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
        
        if (user.Accounts.All(a => a.DivisionPlans.All(dp => dp.Pockets.All(p => p.Id != pocketId))))
        {
            throw new UnauthorizedAccessException();
        }
        
        //Find DailyExpense
        var dailyExpense = await db.DailyExpenses
            .Include(de => de.Expenditures)
            .SingleOrDefaultAsync(de => de.PocketId == pocket.Id && de.Date.Date == dto.Date);
        if (dailyExpense == null)
        {
            throw new NotFoundException();
        }
        
        var wishlist = await db.Wishlists
            .Include(wishlist => wishlist.Account).Include(wishlist => wishlist.Progress)
            .Include(wishlist => wishlist.AffectedDailyExpenses)
            .SingleOrDefaultAsync(w => w.Id == wishlistId);
        if (wishlist == null)
        {
            throw new NotFoundException();
        }

        if (wishlist.Account.UserId == userId)
        {
            throw new UnauthorizedAccessException();
        }
        
        
        //Check if DE is started
        if (!dailyExpense.IsStarted)
        {
            throw new InvalidOperationException("de_not_started");
        }
        
        //Check if Wishlist is Inactive or Completed
        if (wishlist.Status == WishlistStatus.Inactive)
        {
            throw new InvalidOperationException("wishlist_inactive");
        }
        if (wishlist.Status == WishlistStatus.Completed)
        {
            throw new InvalidOperationException("wishlist_completed");
        }
        
        //Expenditure entity, with Wishlist!
        var expense = new Expenditure()
        {
            Name = dto.Name,
            Description = dto.Description,
            Date = dto.Date,
            Price = dto.Amount,
            CategoryId = null,
            Category = null,
            DailyExpenseId =  dailyExpense.Id,
            DailyExpense =  dailyExpense,
            WishlistId = wishlist.Id,
            Wishlist =  wishlist,
        };
        
        await db.Expenditures.AddAsync(expense); //wishlist.Progress SHOULD contain the expense now
        
        //Check if wishlist is finished
        if (wishlist.Progress.Sum(p => p.Price) >= wishlist.Goal)
        {
            //1. set status to Completed
            wishlist.Status = WishlistStatus.Completed;
            
            //2. remove future DEs from AffectedDEs (only for Automatic mode)
            if (wishlist.Mode == WishlistApproachType.Automatic)
            {
                foreach (var de in wishlist.AffectedDailyExpenses.Where(de => de.Date.Date > DateTime.Today).ToList())
                {
                    de.WishlistId = null;
                    de.Wishlist = null;
                }
            }
        }
        
        if(saveImmediately) await db.SaveChangesAsync();
        
    }

    public async Task Activate(string userId, string wishlistId)
    {
        var w = await GetWishlist(userId, wishlistId);
        w.Status = WishlistStatus.Active;
        await db.SaveChangesAsync();
    }

    public async Task Deactivate(string userId, string wishlistId)
    {
        var w = await GetWishlist(userId, wishlistId);
        w.Status = WishlistStatus.Inactive;
        await db.SaveChangesAsync();
    }

    public async Task Delete(string userId, string wishlistId)
    {
        var w = await GetWishlist(userId, wishlistId);
        db.Wishlists.Remove(w);
        await db.SaveChangesAsync();
    }

    public async Task Align(string userId, string dailyExpenseId, string toWishlistId)
    {
        var target = await GetWishlist(userId, toWishlistId);

        var de = await db.DailyExpenses
            .Include(d => d.Pocket).ThenInclude(p => p.DivisionPlan).ThenInclude(dp => dp.Account)
            .SingleOrDefaultAsync(d => d.Id == dailyExpenseId)
            ?? throw new NotFoundException();
        if (de.Pocket.DivisionPlan.Account.UserId != userId)
            throw new UnauthorizedAccessException();

        //Detaching wishlist from source, attaching to target
        de.WishlistId = target.Id;
        await db.SaveChangesAsync();
    }

    private async Task<Wishlist> GetWishlist(string userId, string wishlistId)
    {
        var w = await db.Wishlists
            .Include(w => w.Account)
            .SingleOrDefaultAsync(w => w.Id == wishlistId)
            ?? throw new NotFoundException();
        if (w.Account.UserId != userId) throw new UnauthorizedAccessException();
        return w;
    }
}
