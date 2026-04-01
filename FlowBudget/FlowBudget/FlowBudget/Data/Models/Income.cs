using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Data.Models;

//A single source of income for an account
//e.g. of records
// Income 1 - 200 USD
// Income 2 - 60 USD
// So for account 1 the whole income will be 260 USD
// The splitting of pockets will work with this amount

public class Income
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    public decimal Amount { get; set; }
    
    [Required, MaxLength(50)]
    public string Name { get; set; } = string.Empty;
    
    public string AccountId { get; set; }
    public virtual Account Account { get; set; } = null!;
}