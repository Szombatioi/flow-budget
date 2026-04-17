using AutoMapper;
using FlowBudget.Client.Components.DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class ExpenditureService(ApplicationDbContext db, IMapper mapper, DailyExpenseService dailyExpenseService)
{
    public async Task AddExpenditure(string userId, string pocketId, CreateExpenditureDTO dto)
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

        var newExpenditure = new Expenditure()
        {
            Date = dto.Date ?? DateTime.Now,
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

        // Cascade the EoD change forward through every started day that comes after this one.
        // Required when the expenditure is added to a past day (e.g. today = Apr 5 but
        // days up to Apr 20 are already started) — those later days carried over the old EoD.
        await dailyExpenseService.RecalculateStartedDaysFromDate(pocket.Id, newExpenditure.Date);
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
        
        // Capture before removal so we can cascade afterwards
        var affectedPocketId = expenditure.DailyExpense.PocketId;
        var affectedDate = expenditure.DailyExpense.Date;

        var dailyExpense = await db.DailyExpenses
            .Include(dailyExpense => dailyExpense.Expenditures)
            .SingleAsync(e => e.Id == expenditure.DailyExpense.Id);

        //Remove Expense
        dailyExpense.Expenditures.Remove(expenditure);

        //Recalculate EoD - reason of recalculating from 0 is to avoid glitches
        dailyExpense.EoDAmount = dailyExpense.StartAmount - dailyExpense.Expenditures.Sum(e => e.Price);

        await db.SaveChangesAsync();

        // Cascade the freed-up budget forward through every started day after this one.
        await dailyExpenseService.RecalculateStartedDaysFromDate(affectedPocketId, affectedDate);
    }
}