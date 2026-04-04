using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace FlowBudget.Data.Models;

public class Account
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    //e.g. Revolut, Main account etc.
    [Required, MaxLength(50)]
    public string Name { get; set; }
    
    // Identity User Integration
    public string UserId { get; set; } = string.Empty;
    public virtual ApplicationUser User { get; set; }

    [Required]
    public string CurrencyCode { get; set; } = string.Empty;
    public virtual Currency Currency { get; set; } = null!;

    public virtual ICollection<Income> Incomes { get; set; } = new List<Income>();
    public virtual ICollection<FixedExpense> FixedExpenses { get; set; } = new List<FixedExpense>();
    public virtual ICollection<DivisionPlan> DivisionPlans { get; set; } = new List<DivisionPlan>();
    public virtual ICollection<Pocket> Pockets { get; set; } = new List<Pocket>();
}