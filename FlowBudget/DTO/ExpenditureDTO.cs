using DTO;

namespace FlowBudget.Client.Components.DTO;

public class ExpenditureDTO
{
    public string Id { get; set; }
    public string Name { get; set; }
    public decimal Price { get; set; }
    public DateTime Date { get; set; }
    public string? Description { get; set; }
    // public string
    public string Currency { get; set; }
}

public class CreateExpenditureDTO
{
    public string Name { get; set; }
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public string? CategoryId { get; set; }
    // This is used on Client-side only — used to route the POST to the correct pocket endpoint
    public string? PocketId { get; set; }

    // You can optionally pass a Date
    // (if you upload the data for a previous date, not for today)
    public DateTime? Date { get; set; }
}