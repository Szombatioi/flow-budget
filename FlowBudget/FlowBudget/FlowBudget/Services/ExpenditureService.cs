using AutoMapper;
using AutoMapper.QueryableExtensions;
using FlowBudget.Client.Components.DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class ExpenditureService(ApplicationDbContext db, IMapper mapper, DailyExpenseService dailyExpenseService)
{
    public async Task<Expenditure> AddExpenditure(string userId, string pocketId, CreateExpenditureDTO dto)
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
        
        var targetDate = (dto.Date ?? DateTime.Now).Date;

        //Find DailyExpense — auto-create the month if missing (same flow as the dashboard).
        var dailyExpense = await db.DailyExpenses
            .Include(de => de.Expenditures)
            .SingleOrDefaultAsync(de => de.PocketId == pocket.Id && de.Date.Date == targetDate);
        if (dailyExpense == null)
        {
            await dailyExpenseService.CreateDailyExpenseForMonth(userId, pocket.DivisionPlan.AccountId, targetDate);
            await dailyExpenseService.RecalculateDailyExpenses(pocket.Id, targetDate, activate: true);

            dailyExpense = await db.DailyExpenses
                .Include(de => de.Expenditures)
                .SingleOrDefaultAsync(de => de.PocketId == pocket.Id && de.Date.Date == targetDate);
            if (dailyExpense == null)
            {
                throw new NotFoundException();
            }
        }

        var newExpenditure = new Expenditure()
        {
            Date = targetDate,
            Price = dto.Price,
            Name  = dto.Name,
            Description  = dto.Description,
            CategoryId = dto.CategoryId,
            DailyExpenseId = dailyExpense.Id,
            DailyExpense = dailyExpense
        };
        
        dailyExpense.Expenditures.Add(newExpenditure);

        //Update dailyExpense EoD - we sum all expenses in order to ALWAYS fix misconfigurations (e.g. when EoD was not yet updated :))
        var sumExpenses = dailyExpense.Expenditures.Sum(e => e.Price);
        dailyExpense.EoDAmount = dailyExpense.StartAmount - sumExpenses;

        await db.SaveChangesAsync();
        await dailyExpenseService.RecalculateStartedDaysFromDate(pocket.Id, newExpenditure.Date);

        return newExpenditure;
    }

    public async Task UpdateExpenditure(string userId, string expenditureId, UpdateExpenditureDTO dto)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .ThenInclude(a => a.DivisionPlans)
            .ThenInclude(dp => dp.Pockets)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        var expenditure = await db.Expenditures
            .Include(e => e.DailyExpense)
            .ThenInclude(de => de.Expenditures)
            .SingleOrDefaultAsync(e => e.Id == expenditureId);
        if (expenditure == null) throw new NotFoundException();

        if (user.Accounts.All(a =>
                a.DivisionPlans.All(dp =>
                    dp.Pockets.All(p => p.Id != expenditure.DailyExpense.PocketId))))
        {
            throw new UnauthorizedAccessException();
        }

        expenditure.Name = dto.Name;
        expenditure.Price = dto.Price;
        expenditure.Description = dto.Description;

        var dailyExpense = expenditure.DailyExpense;
        dailyExpense.EoDAmount = dailyExpense.StartAmount - dailyExpense.Expenditures.Sum(e => e.Price);

        await db.SaveChangesAsync();

        await dailyExpenseService.RecalculateStartedDaysFromDate(dailyExpense.PocketId, dailyExpense.Date);
    }

    public async Task RemoveExpenditure(string userId, string expenditureId)
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
        
        var expenditure = await db.Expenditures
            .Include(e => e.DailyExpense)
            .SingleOrDefaultAsync(e => e.Id == expenditureId);
        if (expenditure == null)
        {
            throw new NotFoundException();
        }

        if (user.Accounts.All(a =>
            a.DivisionPlans.All(dp => 
            dp.Pockets.All(p => p.Id != expenditure.DailyExpense.PocketId))))
        {
            throw new UnauthorizedAccessException();
        }
        
        var affectedPocketId = expenditure.DailyExpense.PocketId;
        var affectedDate = expenditure.DailyExpense.Date;

        var dailyExpense = await db.DailyExpenses
            .Include(dailyExpense => dailyExpense.Expenditures)
            .SingleAsync(e => e.Id == expenditure.DailyExpense.Id);
        
        dailyExpense.Expenditures.Remove(expenditure);
        db.Expenditures.Remove(expenditure);

        //Recalculate EoD
        dailyExpense.EoDAmount = dailyExpense.StartAmount - dailyExpense.Expenditures.Sum(e => e.Price);

        await db.SaveChangesAsync();

        // Cascade the freed-up budget forward
        await dailyExpenseService.RecalculateStartedDaysFromDate(affectedPocketId, affectedDate);
    }
    
    public IQueryable<ExpenditureDTO> QueryForUser(string userId)
        => db.Expenditures
            .Where(e => e.DailyExpense.Pocket.DivisionPlan.Account.UserId == userId)
            .ProjectTo<ExpenditureDTO>(mapper.ConfigurationProvider);

    public async Task<ExpenditureStatsDTO> GetStats(string userId, string? accountId = null)
    {
        var today = DateTime.Today;
        var monthStart = new DateTime(today.Year, today.Month, 1);

        // Week starts on Monday in this app.
        var dow = ((int)today.DayOfWeek + 6) % 7;
        var weekStart = today.AddDays(-dow);

        var query = db.Expenditures
            .Where(e => e.DailyExpense.Pocket.DivisionPlan.Account.UserId == userId);

        if (!string.IsNullOrWhiteSpace(accountId))
            query = query.Where(e => e.DailyExpense.Pocket.DivisionPlan.AccountId == accountId);

        var monthly = await query
            .Where(e => e.Date >= monthStart)
            .SumAsync(e => (decimal?)e.Price) ?? 0m;

        var weekly = await query
            .Where(e => e.Date >= weekStart)
            .SumAsync(e => (decimal?)e.Price) ?? 0m;

        return new ExpenditureStatsDTO { Monthly = monthly, Weekly = weekly };
    }
}