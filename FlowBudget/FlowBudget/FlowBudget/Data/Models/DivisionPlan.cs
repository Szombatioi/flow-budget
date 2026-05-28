using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class DivisionPlan : Activable
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public bool IsActive { get; set; } = false;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;

    public virtual ICollection<Pocket> Pockets { get; set; } = new List<Pocket>();
}
