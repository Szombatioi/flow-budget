using FlowBudget.Data.Models;
using Microsoft.AspNetCore.Identity;

namespace FlowBudget.Data;

// Add profile data for application users by adding properties to the ApplicationUser class
public class ApplicationUser : IdentityUser<Guid>
{
    public List<Account> Accounts { get; set; }
}