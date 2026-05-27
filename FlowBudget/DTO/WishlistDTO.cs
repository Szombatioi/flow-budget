namespace DTO;

public enum WishlistApproachType
{
    ManualOnly,
    Automatic
}

public class WishlistDTO
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public WishlistApproachType ApproachType { get; set; }
    public decimal CurrentAmount { get; set; }
    public decimal TargetAmount { get; set; }
    public DateTime TargetDate { get; set; }
    public DateTime? EstimatedFinishDate { get; set; }
    public string CurrencyCode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public WishlistStatus Status { get; set; }
}

public enum WishlistStatus
{
    Inactive = 0,
    Active = 1,
    Completed = 2,
}

public class CreateWishlistDTO
{
    public string AccountId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal TargetAmount { get; set; }
    public DateTime TargetDate { get; set; }
    public WishlistApproachType ApproachType { get; set; }

    // Only relevant when ApproachType == Automatic.
    public DateTime? AffectedFromDate { get; set; }
    public DateTime? AffectedToDate { get; set; }
    public string? PocketId { get; set; }
    public List<string> AffectedDailyExpenseIds { get; set; } = new();
}

// Used by the "Affected DEs" picker on /wishlist/new.
public class WishlistAffectedExpenseDTO
{
    public string Id { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string PocketName { get; set; } = string.Empty;
}
