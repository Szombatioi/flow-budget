namespace DTO;

public class IncomeModifyDTO
{
    public IncomeDTO Income { get; set; }
    public ModificationMethod Method { get; set; }
}

public enum ModificationMethod
{
    CREATE,
    MODIFY,
    DELETE
}
