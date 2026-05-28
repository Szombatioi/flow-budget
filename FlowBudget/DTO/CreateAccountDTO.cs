namespace DTO;

public class CreateAccountDTO
{
    public string CurrencyCode { get; set; }
    public string Name { get; set; }
    
}

public class UpdateAccountDTO
{
    public string Name { get; set; } = string.Empty;
}