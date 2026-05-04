using FlowBudget.Data;
using FlowBudget.Data.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FlowBudget.Services;

public class SeederService(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
{
    private const string AdminUsername = "admin";
    private const string AdminEmail    = "admin@flowbudget.local";
    private const string AdminPassword = "admin";

    public async Task SeedAdminUser()
    {
        var admin = await userManager.FindByNameAsync(AdminUsername);

        if (admin == null)
        {
            admin = new ApplicationUser
            {
                UserName = AdminUsername,
                Email    = AdminEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(admin, AdminPassword);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Failed to seed admin user: {errors}");
            }
        }

        // Always ensure the claim is present — handles existing users created before
        // this claim was introduced (e.g. from a previous container run).
        var existingClaims = await userManager.GetClaimsAsync(admin);
        if (!existingClaims.Any(c => c.Type == "admin" && c.Value == "true"))
        {
            await userManager.AddClaimAsync(admin, new Claim("admin", "true"));
        }
    }

    public async Task SeedCategories()
    {
        var categories = new List<Category>
        {
            new() { Name = "Clothes",             DisplayName = "seeded_category_clothes" },
            new() { Name = "Foods/Drinks",         DisplayName = "seeded_category_foods_drinks" },
            new() { Name = "Sports and hobbies",   DisplayName = "seeded_category_sports_hobbies" },
            new() { Name = "Transportation",        DisplayName = "seeded_category_transportation" },
            new() { Name = "Housing",               DisplayName = "seeded_category_housing" },
        };

        foreach (var category in categories)
        {
            var exists = await db.Categories.AnyAsync(c => c.Name == category.Name);
            if (!exists)
                await db.Categories.AddAsync(category);
        }

        await db.SaveChangesAsync();
    }

    public async Task SeedCurrencies()
    {
        var currencies = new List<Currency>
        {
            new() { Code = "HUF", Name = "currency_huf", Country = "currency_country_huf" },
            new() { Code = "EUR", Name = "currency_eur", Country = null }
        };

        var insertables = new List<Currency>();
        foreach (var currency in currencies)
        {
            var existing = await db.Currencies.FindAsync(currency.Code);
            if (existing == null)
                insertables.Add(currency);
        }

        await db.Currencies.AddRangeAsync(insertables);
        await db.SaveChangesAsync();
    }
}
