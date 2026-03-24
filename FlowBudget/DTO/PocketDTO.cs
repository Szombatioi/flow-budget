namespace DTO;

public class PocketDTO
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public decimal Money { get; set; }
    public double Ratio { get; set; } // e.g., 25.5 for 25.5%
}

public class PocketModifyDTO
{
    public PocketDTO Pocket { get; set; } = null!;
    public ModificationMethod Method { get; set; }
}