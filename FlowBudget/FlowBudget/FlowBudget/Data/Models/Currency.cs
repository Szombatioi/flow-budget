using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class Currency
{
    [Key]
    public string Name { get; set; } //e.g. HUF, USD
}