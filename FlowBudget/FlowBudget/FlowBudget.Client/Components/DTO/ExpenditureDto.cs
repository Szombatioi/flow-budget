namespace FlowBudget.Client.Components.DTO;

public class ExpenditureDto
{
    public string Id { get; set; }
    public string Name { get; set; }
    public int Price { get; set; }
    public DateTime Date { get; set; }
    public string? Description { get; set; }
    // public string
    public string Currency { get; set; }
}