namespace FlowBudget.Data.Models;

public class DivisionPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public bool IsActive { get; set; }
    
    public Guid AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;

    public virtual ICollection<Pocket> Pockets { get; set; } = new List<Pocket>();
}