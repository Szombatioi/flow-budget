namespace DTO;

public class CreateAccountDTO
{
    //(UserId) already given via Cookie
    public string CurrencyCode { get; set; }
    public string Name { get; set; }
    
    //CostBudgets, DivisionPlans and Pockets are created later
}