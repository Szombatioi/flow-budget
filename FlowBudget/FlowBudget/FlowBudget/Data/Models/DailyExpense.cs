using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class DailyExpense
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [DataType(DataType.Date)]
    public DateTime Date { get; set; }
    public decimal StartAmount { get; set; }
    public decimal EoDAmount { get; set; } //Initially this is the same as StartAmount
    public decimal RelativeBudget { get; set; } //How much the user could spend each day (not counting the past days' remaining money)

    public string PocketId { get; set; }
    public virtual Pocket Pocket { get; set; } = null!;
    public bool IsStarted { get; set; } = false;
    public virtual ICollection<Expenditure> Expenditures { get; set; } = new List<Expenditure>();
}