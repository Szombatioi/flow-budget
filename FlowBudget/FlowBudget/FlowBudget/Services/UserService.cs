using System.Globalization;
using DTO;
using FlowBudget.Data;
using FlowBudget.Services.Exceptions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Services;

public class UserService(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
{
    public async Task<UserBaseDTO> Get(string userId)
    {
        var user = await db.Users
            .Include(u => u.Accounts)
            .SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null)
        {
            throw new NotFoundException();
        }

        return new UserBaseDTO()
        {
            Id = user.Id,
            AccountIds = user.Accounts.Select(a => a.Id).ToList(),
            Theme = user.Theme,
            Language = user.Language,
        };
    }

    public async Task<UserSettingsDTO> GetSettings(string userId)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        return new UserSettingsDTO
        {
            UserName = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            Theme = user.Theme,
            Language = user.Language,
            HasApiKey = !string.IsNullOrWhiteSpace(user.ApiKey),
        };
    }

    public async Task UpdateProfile(string userId, UpdateProfileDTO dto)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) throw new NotFoundException();

        var result = await userManager.SetUserNameAsync(user, dto.UserName);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }

    public async Task ChangePassword(string userId, ChangePasswordDTO dto)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) throw new NotFoundException();

        var result = await userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }

    public async Task UpdatePreferences(string userId, UpdatePreferencesDTO dto)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new NotFoundException();

        user.Theme = dto.Theme;
        user.Language = dto.Language;
        await db.SaveChangesAsync();
    }

    /// <summary>Verifies the user's password and returns their API key.</summary>
    public async Task<string?> RevealApiKey(string userId, RevealApiKeyDTO dto)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) throw new NotFoundException();

        var valid = await userManager.CheckPasswordAsync(user, dto.Password);
        if (!valid) throw new UnauthorizedAccessException("invalid_password");

        return user.ApiKey;
    }

    /// <summary>Verifies the user's password, then saves the new API key.</summary>
    public async Task UpdateApiKey(string userId, UpdateApiKeyDTO dto)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) throw new NotFoundException();

        var valid = await userManager.CheckPasswordAsync(user, dto.Password);
        if (!valid) throw new UnauthorizedAccessException("invalid_password");

        user.ApiKey = dto.ApiKey;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }
    }
}
