using System.Collections.Concurrent;
using System.Reflection;
using System.Security.Claims;
using FlowBudget.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FlowBudget.Services.Crypto;

/// <summary>
/// EF Core interceptor that transparently encrypts properties marked with
/// <see cref="EncryptedAttribute"/> on save and decrypts them on materialization.
///
/// Convention: a plaintext property <c>Foo</c> with <c>[Encrypted]</c> must have a
/// companion <c>byte[]?</c> property named <c>FooEnc</c> which is what actually maps
/// to the DB column. The plaintext property should be <c>[NotMapped]</c>.
/// </summary>
public class EncryptedFieldsInterceptor : IMaterializationInterceptor, ISaveChangesInterceptor
{
    private static readonly ConcurrentDictionary<Type, EncryptedFieldMap[]> Cache = new();

    private readonly IDekProvider _dekProvider;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<EncryptedFieldsInterceptor> _logger;

    public EncryptedFieldsInterceptor(
        IDekProvider dekProvider,
        IHttpContextAccessor http,
        ILogger<EncryptedFieldsInterceptor> logger)
    {
        _dekProvider = dekProvider;
        _http = http;
        _logger = logger;
    }

    public object InitializedInstance(MaterializationInterceptionData materializationData, object entity)
    {
        var maps = GetMaps(entity.GetType());
        if (maps.Length == 0) return entity;

        var userId = ResolveUserId(entity);
        if (userId is null) return entity; // no DEK context (e.g., Hangfire) → leave ciphertext

        byte[] dek;
        try
        {
            dek = _dekProvider.GetDekAsync(userId).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not resolve DEK for user {UserId} during materialization; leaving ciphertext.", userId);
            return entity;
        }

        foreach (var map in maps)
        {
            var cipher = (byte[]?)map.CipherProperty.GetValue(entity);
            if (cipher is null || cipher.Length == 0) continue;
            try
            {
                var plaintext = AesGcmCipher.Decrypt(dek, cipher);
                map.PlaintextProperty.SetValue(entity, plaintext);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt {Type}.{Field} for user {UserId}.",
                    entity.GetType().Name, map.PlaintextProperty.Name, userId);
            }
        }
        return entity;
    }

    public async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var ctx = eventData.Context;
        if (ctx is null) return result;

        foreach (var entry in ctx.ChangeTracker.Entries())
        {
            if (entry.State != EntityState.Added && entry.State != EntityState.Modified)
                continue;

            var maps = GetMaps(entry.Entity.GetType());
            if (maps.Length == 0) continue;

            var userId = ResolveUserId(entry.Entity);
            if (userId is null)
            {
                _logger.LogWarning("No user context for saving {Type}; encrypted fields will not be written.",
                    entry.Entity.GetType().Name);
                continue;
            }

            byte[] dek;
            try
            {
                dek = await _dekProvider.GetDekAsync(userId, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve DEK for user {UserId} while saving {Type}.",
                    userId, entry.Entity.GetType().Name);
                throw;
            }

            foreach (var map in maps)
            {
                var plaintext = (string?)map.PlaintextProperty.GetValue(entry.Entity);
                if (plaintext is null)
                {
                    map.CipherProperty.SetValue(entry.Entity, null);
                    entry.Property(map.CipherProperty.Name).IsModified = true;
                    continue;
                }
                var cipher = AesGcmCipher.Encrypt(dek, plaintext);
                map.CipherProperty.SetValue(entry.Entity, cipher);
                entry.Property(map.CipherProperty.Name).IsModified = true;
            }
        }

        return result;
    }

    public InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        return SavingChangesAsync(eventData, result).GetAwaiter().GetResult();
    }

    private string? ResolveUserId(object entity)
    {
        // ApplicationUser is self-referential: the entity IS the user.
        if (entity is ApplicationUser au && !string.IsNullOrWhiteSpace(au.Id))
            return au.Id;

        return _http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    private static EncryptedFieldMap[] GetMaps(Type type) =>
        Cache.GetOrAdd(type, static t =>
        {
            var list = new List<EncryptedFieldMap>();
            foreach (var prop in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (prop.GetCustomAttribute<EncryptedAttribute>() is null) continue;
                if (prop.PropertyType != typeof(string))
                    throw new InvalidOperationException(
                        $"[Encrypted] must be applied to a string property; {t.Name}.{prop.Name} is {prop.PropertyType}.");
                var cipherName = prop.Name + "Enc";
                var cipherProp = t.GetProperty(cipherName, BindingFlags.Public | BindingFlags.Instance)
                    ?? throw new InvalidOperationException(
                        $"[Encrypted] property {t.Name}.{prop.Name} requires a companion byte[] property named {cipherName}.");
                if (cipherProp.PropertyType != typeof(byte[]))
                    throw new InvalidOperationException(
                        $"Companion property {t.Name}.{cipherName} must be byte[].");
                list.Add(new EncryptedFieldMap(prop, cipherProp));
            }
            return list.ToArray();
        });

    private readonly record struct EncryptedFieldMap(PropertyInfo PlaintextProperty, PropertyInfo CipherProperty);
}
