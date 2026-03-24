namespace DTO;

public class UserBaseDTO
{
    public Guid Id { get; set; }
    public List<Guid> AccountIds { get; set; }
}