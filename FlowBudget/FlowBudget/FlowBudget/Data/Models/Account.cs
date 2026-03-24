using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace FlowBudget.Data.Models;

public class Account
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Identity User Integration
    public string UserId { get; set; } = string.Empty;
    public virtual IdentityUser User { get; set; }

    [Required]
    public string CurrencyId { get; set; } = string.Empty;
    public virtual Currency Currency { get; set; } = null!;

    public virtual ICollection<CostBudget> CostBudgets { get; set; } = new List<CostBudget>();
    public virtual ICollection<DivisionPlan> DivisionPlans { get; set; } = new List<DivisionPlan>();
    public virtual ICollection<Pocket> Pockets { get; set; } = new List<Pocket>();
}