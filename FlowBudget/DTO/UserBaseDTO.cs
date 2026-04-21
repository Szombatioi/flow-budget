namespace DTO;

public class UserBaseDTO
{
    public string Id { get; set; }
    public List<string> AccountIds { get; set; }
    public string? Theme { get; set; }
    public string? Language { get; set; }
}