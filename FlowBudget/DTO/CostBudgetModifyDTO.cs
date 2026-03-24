namespace DTO;

public class CostBudgetModifyDTO
{
    public CostBudgetDTO CostBudget { get; set; }
    public ModificationMethod Method { get; set; }
}

public enum ModificationMethod
{
    CREATE,
    MODIFY,
    DELETE
}
