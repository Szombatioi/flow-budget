namespace FlowBudget.Data.Models;

//Ration: how much % of the whole budget this pocket gets
//Money: % converted to currency
//The daily expenses of a month will be calculated based on the Money property
public class Pocket : Activable
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    public string Name { get; set; } = string.Empty;
    // public decimal Money { get; set; } //We removed money since ration and incomes can determine money
    public double Ration { get; set; } // Percentage (e.g., 0.25 for 25%)

    // public string AccountId { get; set; }
    // public virtual Account Account { get; set; } = null!;

    /// <summary>
    /// Points to the first-ever version of this pocket.
    /// Null on legacy rows — treat as Id in that case.
    /// No FK/navigation property to avoid self-referencing FK complications.
    /// </summary>
    public string? OriginalPocketId { get; set; }

    public string DivisionPlanId { get; set; }
    public virtual DivisionPlan DivisionPlan { get; set; }

    public virtual ICollection<DailyExpense> DailyExpenses { get; set; } = new List<DailyExpense>();
}