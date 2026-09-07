using System.ComponentModel.DataAnnotations.Schema;
using FlowBudget.Data.Models;
using FlowBudget.Services.Crypto;
using Microsoft.AspNetCore.Identity;

namespace FlowBudget.Data;

public class ApplicationUser : IdentityUser<string>
{
    public ApplicationUser()
    {
        Id = Guid.NewGuid().ToString();
    }
    public List<Account> Accounts { get; set; }
    public List<Category> Categories { get; set; }

    [NotMapped]
    [Encrypted]
    public string? ApiKey { get; set; } = null;

    // Companion cipher column for [Encrypted] ApiKey — written by EncryptedFieldsInterceptor.
    public byte[]? ApiKeyEnc { get; set; }

    public string? Theme { get; set; } = null;    // "light" / "dark"
    public string? Language { get; set; } = null; // e.g. "en", "hu"
    public bool NotificationsEnabled { get; set; } = false;

    // Envelope-encryption key material.
    public byte[]? WrappedDek { get; set; }
    public int KekVersion { get; set; }
    public DateTime? DekCreatedAt { get; set; }
}
