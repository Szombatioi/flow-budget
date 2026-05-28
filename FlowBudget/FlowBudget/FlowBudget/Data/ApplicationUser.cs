using FlowBudget.Data.Models;
using Microsoft.AspNetCore.Identity;

namespace FlowBudget.Data;

public class ApplicationUser : IdentityUser<string>
{
    public ApplicationUser()
    {
        Id = Guid.NewGuid().ToString();
    }
    public List<Account> Accounts { get; set; }
    public List<Category> Categories { get; set; }

    public string? ApiKey { get; set; } = null;
    public string? Theme { get; set; } = null;    // "light" / "dark"
    public string? Language { get; set; } = null; // e.g. "en", "hu"
    public bool NotificationsEnabled { get; set; } = false;
}
