using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

//To seed default values e.g. categories
public class SeederService(ApplicationDbContext db)
{
    public async Task SeedCategories()
    {
        var categories = new List<Category>();
        categories.Add(new Category()
        {
            Name = "Clothes",
            DisplayName = "seeded_category_clothes",
        });
        
        categories.Add(new Category()
        {
            Name = "Foods/Drinks",
            DisplayName = "seeded_category_foods_drinks",
        });
        
        categories.Add(new Category()
        {
            Name = "Sports and hobbies",
            DisplayName = "seeded_category_sports_hobbies",
        });
        
        categories.Add(new Category()
        {
            Name = "Transportation",
            DisplayName = "seeded_category_transportation",
        });
        
        categories.Add(new Category()
        {
            Name = "Housing",
            DisplayName = "seeded_category_housing",
        });
        
        foreach (var category in categories)
        {
            var existingCategory = await db.Categories.SingleOrDefaultAsync(c => c.Name == category.Name);
            if (existingCategory == null)
            {
                await db.Categories.AddAsync(category);
            }
        }
        
        await db.SaveChangesAsync();
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
            var existingCurrency = await db.Currencies.FindAsync(currency.Code);
            if(existingCurrency != null) continue;
            insertables.Add(currency);
        }
        
        await db.Currencies.AddRangeAsync(insertables);
        await db.SaveChangesAsync();
    }
}