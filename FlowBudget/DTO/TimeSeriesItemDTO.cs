namespace DTO;

public class TimeSeriesItemDTO
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Category { get; set; }
    public DateTime Date { get; set; }
}
