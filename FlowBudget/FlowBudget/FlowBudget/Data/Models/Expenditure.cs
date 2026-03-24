using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class Expenditure
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime Date { get; set; } = DateTime.Now;
    public decimal Amount { get; set; }
    
    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public Guid DailyExpenseId { get; set; }
    public virtual DailyExpense DailyExpense { get; set; } = null!;
}