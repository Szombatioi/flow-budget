namespace DTO;

public class FixedExpenseDTO
{
    public string Id { get; set; }
    public string Name { get; set; }
    public decimal Amount { get; set; }
}

public class CreateFixedExpenseDTO
{
    public string AccountId { get; set; }
    public string Name { get; set; }
    public decimal Amount { get; set; }
}

public class EditFixedExpenseDTO
{
    public string Id { get; set; }
    public string? Name { get; set; }
    public decimal? Amount { get; set; }
}