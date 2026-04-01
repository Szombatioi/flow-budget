namespace FlowBudget.Data.Models;

public class Pocket
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public decimal Money { get; set; }
    public double Ration { get; set; } // Percentage (e.g., 0.25 for 25%)

    public string AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;

    public string? DivisionPlanId { get; set; }
    public virtual DivisionPlan? DivisionPlan { get; set; }

    public virtual ICollection<DailyExpense> DailyExpenses { get; set; } = new List<DailyExpense>();
}