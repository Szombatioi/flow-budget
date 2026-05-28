namespace DTO;

public class ExportParameterDTO
{
    // Empty list = no filter
    public List<CategoryDTO> Categories { get; set; } = new();

    // Empty list = no filter
    public List<PocketDTO> Pockets { get; set; } = new();

    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    
    public string ExportingFormat { get; set; } = string.Empty;

    // For TxtExportStrategy
    public string? Separator { get; set; }
    public string CurrencyName { get; set; }
}
