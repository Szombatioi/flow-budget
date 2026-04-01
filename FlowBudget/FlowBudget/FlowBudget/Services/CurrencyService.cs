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

    public async Task SeedCurrencies()
    {
        List<Currency> currencies = new List<Currency>()
        {
            new Currency()
            {
                Code = "HUF",
                Name = "currency_huf",
                Country = "currency_country_huf"
            },
            new Currency()
            {
                Code = "EUR",
                Name = "currency_eur",
                Country = null //Many countries have Euro
            }
        };
        
        var insertables = new List<Currency>();
        foreach (var currency in currencies)
        {
            var existingCurrency = await _db.Currencies.FindAsync(currency.Code);
            if(existingCurrency != null) continue;
            insertables.Add(currency);
        }
        
        await db.Currencies.AddRangeAsync(insertables);
        await db.SaveChangesAsync();
    }
}