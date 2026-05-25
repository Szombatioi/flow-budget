namespace DTO;

public class ExportParameterDTO
{
    // Empty list == "no category filter" (export every category).
    public List<CategoryDTO> Categories { get; set; } = new();

    // Empty list == "no pocket filter".
    public List<PocketDTO> Pockets { get; set; } = new();

    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }

    // Case-insensitive against the strategy's Format property.
    public string ExportingFormat { get; set; } = string.Empty;

    // Only honored by TxtExportStrategy. Defaults to a pipe if not provided.
    public string? Separator { get; set; }
    public string CurrencyName { get; set; }
}
