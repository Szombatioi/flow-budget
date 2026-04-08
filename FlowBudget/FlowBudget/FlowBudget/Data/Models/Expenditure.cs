using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class Expenditure
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime Date { get; set; } = DateTime.Now;
    public decimal Price { get; set; }

    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public string? CategoryId { get; set; }
    public virtual Category? Category { get; set; }

    public string DailyExpenseId { get; set; }
    public virtual DailyExpense DailyExpense { get; set; } = null!;
}
