namespace FlowBudget.Data.Models;

public class Pocket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public decimal Money { get; set; }
    public double Ration { get; set; } // Percentage (e.g., 0.25 for 25%)

    public Guid AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;

    public Guid? DivisionPlanId { get; set; }
    public virtual DivisionPlan? DivisionPlan { get; set; }

    public virtual ICollection<DailyExpense> DailyExpenses { get; set; } = new List<DailyExpense>();
}