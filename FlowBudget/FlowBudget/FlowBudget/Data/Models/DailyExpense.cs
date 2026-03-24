using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class DailyExpense
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [DataType(DataType.Date)]
    public DateTime Date { get; set; }
    public decimal StartAmount { get; set; }
    public decimal EoDAmount { get; set; }

    public Guid PocketId { get; set; }
    public virtual Pocket Pocket { get; set; } = null!;

    public virtual ICollection<Expenditure> Expenditures { get; set; } = new List<Expenditure>();
}