using FlowBudget.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FlowBudget.Services.Crypto;

public class DekProvider : IDekProvider
{
    private const string HttpContextKey = "fb.dek";
    private static readonly TimeSpan CacheSliding = TimeSpan.FromMinutes(10);

    private readonly ApplicationDbContext _db;
    private readonly IKmsService _kms;
    private readonly IMemoryCache _cache;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<DekProvider> _logger;

    public DekProvider(
        ApplicationDbContext db,
        IKmsService kms,
        IMemoryCache cache,
        IHttpContextAccessor http,
        ILogger<DekProvider> logger)
    {
        _db = db;
        _kms = kms;
        _cache = cache;
        _http = http;
        _logger = logger;
    }

    public async Task<byte[]> GetDekAsync(string userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentException("userId must be provided.", nameof(userId));

        var ctx = _http.HttpContext;
        if (ctx?.Items.TryGetValue(RequestKey(userId), out var cached) == true && cached is byte[] fromReq)
            return fromReq;

        if (_cache.TryGetValue(CacheKey(userId), out byte[]? memHit) && memHit is not null)
        {
            if (ctx is not null) ctx.Items[RequestKey(userId)] = memHit;
            return memHit;
        }

        // Bypass the encryption interceptor by projecting into an anonymous type.
        var row = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.WrappedDek, u.KekVersion })
            .SingleOrDefaultAsync(ct);

        if (row is null || row.WrappedDek is null || row.WrappedDek.Length == 0)
            throw new InvalidOperationException($"User {userId} has no wrapped DEK.");

        var dek = await _kms.UnwrapAsync(row.WrappedDek, row.KekVersion, ct);

        _cache.Set(CacheKey(userId), dek, new MemoryCacheEntryOptions
        {
            SlidingExpiration = CacheSliding,
            Size = 1
        });
        if (ctx is not null) ctx.Items[RequestKey(userId)] = dek;

        return dek;
    }

    public void Evict(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        _cache.Remove(CacheKey(userId));
        var ctx = _http.HttpContext;
        ctx?.Items.Remove(RequestKey(userId));
        _logger.LogInformation("Evicted cached DEK for user {UserId}", userId);
    }

    private static string CacheKey(string userId) => $"fb.dek::{userId}";
    private static string RequestKey(string userId) => $"{HttpContextKey}::{userId}";
}
