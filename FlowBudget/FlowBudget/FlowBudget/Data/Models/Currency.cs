using System.ComponentModel.DataAnnotations;

namespace FlowBudget.Data.Models;

public class Currency
{
    [Key] public string Code { get; set; } //e.g. HUF, USD
    public string Name { get; set; } //A translated name, e.g. currency_hun = Forint
    //NOT required, as e.g. EUR is used in many countries
    public string? Country { get; set; } //A translated country, e.g. currency_country_hun = Magyarország
}