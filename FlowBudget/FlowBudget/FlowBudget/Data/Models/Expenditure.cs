using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using FlowBudget.Services.Crypto;

namespace FlowBudget.Data.Models;

public class Expenditure
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime Date { get; set; } = DateTime.Now;
    public decimal Price { get; set; }

    [NotMapped]
    [Encrypted]
    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;
    public byte[]? NameEnc { get; set; }

    [NotMapped]
    [Encrypted]
    public string? Description { get; set; }
    public byte[]? DescriptionEnc { get; set; }

    public string? CategoryId { get; set; }
    public virtual Category? Category { get; set; }

    public string DailyExpenseId { get; set; }
    public virtual DailyExpense DailyExpense { get; set; } = null!;


    public string? WishlistId { get; set; }
    public virtual Wishlist? Wishlist { get; set; }
}
