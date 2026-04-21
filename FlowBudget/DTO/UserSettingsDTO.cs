namespace DTO;

public class UserSettingsDTO
{
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Theme { get; set; }
    public string? Language { get; set; }
    public bool HasApiKey { get; set; }
}

public class UpdateProfileDTO
{
    public string UserName { get; set; } = string.Empty;
}

public class ChangePasswordDTO
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdatePreferencesDTO
{
    public string? Theme { get; set; }
    public string? Language { get; set; }
}

public class RevealApiKeyDTO
{
    public string Password { get; set; } = string.Empty;
}

public class UpdateApiKeyDTO
{
    public string Password { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
}
