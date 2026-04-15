using DTO;
using FlowBudget.Data;
using FlowBudget.Data.Models;
using FlowBudget.Services.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class CategoryService(ApplicationDbContext db)
{
    public async Task<List<CategoryDTO>> GetAllCategories(string userId)
    {
        return await db.Categories
            .Where(c => c.UserId == null || c.UserId == userId)
            .Select(c => new CategoryDTO
            {
                Id = c.Id,
                Name = c.Name,
                DisplayName = c.DisplayName,
                IsSystem = c.UserId == null
            })
            .ToListAsync();
    }

    public async Task CreateCategory(string userId, CreateCategoryDTO dto)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }

        var category = new Category
        {
            Name = dto.Name,
            DisplayName = dto.Name,
            UserId = user.Id,
            User = user,
        };

        await db.Categories.AddAsync(category);
        await db.SaveChangesAsync();
    }

    public async Task UpdateCategory(string userId, EditCategoryDTO dto)
    {
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == dto.Id);
        if (category == null)
        {
            throw new NotFoundException();
        }

        if (category.UserId == null || category.UserId != userId)
        {
            throw new UnauthorizedAccessException();
        }

        category.Name = dto.Name;
        category.DisplayName = dto.Name;
        await db.SaveChangesAsync();
    }

    public async Task DeleteCategory(string userId, string categoryId)
    {
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == categoryId);
        if (category == null)
        {
            throw new NotFoundException();
        }

        if (category.UserId == null)
        {
            throw new UnauthorizedAccessException();
        }

        if (category.UserId != userId)
        {
            throw new UnauthorizedAccessException();
        }
        
        //Set category to null for ALL expenditures that reference this
        var expenditures = await db.Expenditures
            .Include(e => e.Category)
            .Where(e => e.CategoryId == category.Id)
            .ToListAsync();
        foreach (var expenditure in expenditures)
        {
            expenditure.Category = null;
            expenditure.CategoryId = null;
        }

        db.Categories.Remove(category);
        await db.SaveChangesAsync();
    }
}
