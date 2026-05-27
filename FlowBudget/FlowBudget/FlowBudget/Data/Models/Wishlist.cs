using System.ComponentModel.DataAnnotations;
using DTO;

namespace FlowBudget.Data.Models;

public class Wishlist
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public WishlistStatus Status { get; set; } = WishlistStatus.Inactive;
    public WishlistApproachType Mode { get; set; } = WishlistApproachType.ManualOnly;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Goal { get; set; }
    public DateTime TargetDate { get; set; }

    public string AccountId { get; set; } = string.Empty;
    public virtual Account Account { get; set; } = null!;
    
    public virtual List<Expenditure> Progress { get; set; } = new List<Expenditure>();

    //Only for mode 2 (automatic)
    //For mode 1, this is null
    public virtual List<DailyExpense> AffectedDailyExpenses { get; set; } = new List<DailyExpense>();
}
