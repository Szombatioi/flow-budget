namespace DTO;

public class PocketDTO
{
    public string Id { get; set; }
    public string Name { get; set; }
    // public decimal Money { get; set; }
    public double Ration { get; set; } // e.g., 25.5 for 25.5%
    public string DivisionPlanId { get; set; }
}

public class CreatePocketDTO
{
    public string Name { get; set; }
    // public decimal Money { get; set; }
    public double Ration { get; set; }
}

public class EditPocketDTO
{
    public string Id { get; set; }
    public string? Name { get; set; }
    
    public double? Ration { get; set; }
}

public class PocketModifyDTO
{
    public PocketDTO Pocket { get; set; } = null!;
    public ModificationMethod Method { get; set; }
}