using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class FixedExpense : Activable
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    public decimal Amount { get; set; }
    
    [Required, MaxLength(50)]
    public string Name { get; set; } = string.Empty;
    
    public string AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;
}