namespace FlowBudget.Data.Models;

public class DivisionPlan
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public bool IsActive { get; set; }
    
    public string AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;

    public virtual ICollection<Pocket> Pockets { get; set; } = new List<Pocket>();
}