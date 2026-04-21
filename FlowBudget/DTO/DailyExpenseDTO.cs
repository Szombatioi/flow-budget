using FlowBudget.Client.Components.DTO;

namespace DTO;

public class DailyExpenseDTO
{
    public string Id { get; set; }
    public decimal StartAmount { get; set; }
    public decimal EoDAmount { get; set; }
    public decimal RelativeDailyAmount { get; set; }
    public PocketDTO Pocket { get; set; }
    public bool IsStarted { get; set; }
    public List<ExpenditureDTO> Expenditures { get; set; }
}