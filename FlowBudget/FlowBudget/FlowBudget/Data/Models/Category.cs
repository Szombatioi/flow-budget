using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class Category
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [Required, MaxLength(50)]
    public string Name { get; set; }
    
    //For seeded categories, this is a translatable text
    //Example: if UserId is null -> @L[category.DisplayName]
    [Required, MaxLength(50)]
    public string DisplayName { get; set; } 
    
    //Nullable properties, because there are common categories
    public string? UserId { get; set; }
    public virtual ApplicationUser? User { get; set; }
}