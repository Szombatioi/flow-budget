namespace DTO;

public class DailyBudgetDTO
{
    public DateTime Date { get; set; }

    //RelativeBudget
    public decimal Amount { get; set; }

    //StartAmount - extra budget
    public decimal StartAmount { get; set; }
}
