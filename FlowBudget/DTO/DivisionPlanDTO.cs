namespace DTO;

public class DivisionPlanDTO
{
    public string Id { get; set; }
    public bool IsActive { get; set; }
    public DateTime ActiveFrom { get; set; }
    public AccountDTO Account { get; set; }
    public List<PocketDTO> Pockets { get; set; }
}

public class CreateDivisionPlanDTO
{
    public string AccountId { get; set; }
}