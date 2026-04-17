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

    /// <summary>
    /// Points to the first-ever version of this fixed expense (lineage anchor).
    /// Null on legacy rows — treat as Id in that case.
    /// </summary>
    public string? OriginalFixedExpenseId { get; set; }
}