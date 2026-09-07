using System.Text;
using VaultSharp;
using VaultSharp.V1.AuthMethods;
using VaultSharp.V1.AuthMethods.AppRole;
using VaultSharp.V1.AuthMethods.Token;
using VaultSharp.V1.SecretsEngines.Transit;

namespace FlowBudget.Services.Crypto;

public class VaultKmsService : IKmsService
{
    private readonly IVaultClient _client;
    private readonly string _keyName;
    public int CurrentKekVersion { get; }

    public VaultKmsService(IConfiguration configuration, ILogger<VaultKmsService> logger)
    {
        var address = configuration["Kms:VaultAddress"]
            ?? throw new InvalidOperationException("Kms:VaultAddress not configured.");
        _keyName = configuration["Kms:KeyName"]
            ?? throw new InvalidOperationException("Kms:KeyName not configured.");
        CurrentKekVersion = int.Parse(configuration["Kms:CurrentKekVersion"] ?? "1");

        var roleId = configuration["Kms:RoleId"];
        var secretId = configuration["Kms:SecretId"];
        var token = configuration["Kms:Token"];

        IAuthMethodInfo authMethod;
        if (!string.IsNullOrWhiteSpace(roleId) && !string.IsNullOrWhiteSpace(secretId))
        {
            logger.LogInformation("Vault auth: AppRole ({VaultAddress})", address);
            authMethod = new AppRoleAuthMethodInfo(roleId, secretId);
        }
        else if (!string.IsNullOrWhiteSpace(token))
        {
            logger.LogInformation("Vault auth: Token ({VaultAddress}) — dev mode", address);
            authMethod = new TokenAuthMethodInfo(token);
        }
        else
        {
            throw new InvalidOperationException(
                "Kms auth is not configured. Set either Kms:RoleId + Kms:SecretId (AppRole) or Kms:Token (dev).");
        }

        _client = new VaultClient(new VaultClientSettings(address, authMethod));
    }

    public async Task<byte[]> WrapAsync(byte[] dek, int kekVersion, CancellationToken ct = default)
    {
        var options = new EncryptRequestOptions
        {
            Base64EncodedPlainText = Convert.ToBase64String(dek),
            KeyVersion = kekVersion
        };
        var response = await _client.V1.Secrets.Transit.EncryptAsync(_keyName, options);
        return Encoding.UTF8.GetBytes(response.Data.CipherText);
    }

    public async Task<byte[]> UnwrapAsync(byte[] wrappedDek, int kekVersion, CancellationToken ct = default)
    {
        var ciphertext = Encoding.UTF8.GetString(wrappedDek);
        var options = new DecryptRequestOptions { CipherText = ciphertext };
        var response = await _client.V1.Secrets.Transit.DecryptAsync(_keyName, options);
        return Convert.FromBase64String(response.Data.Base64EncodedPlainText);
    }
}
