using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class CurrencyService(ApplicationDbContext db)
{
    // private readonly ILogger<CurrencyService> _logger;
    private readonly ApplicationDbContext _db = db;

    public async Task<List<CurrencyDTO>> GetAllCurrencies()
    {
        return await db.Currencies
            .Select(c => new CurrencyDTO()
            {
                Code = c.Code,
                Name = c.Name,
                Country = c.Country,
            })
            .ToListAsync();
    }
}