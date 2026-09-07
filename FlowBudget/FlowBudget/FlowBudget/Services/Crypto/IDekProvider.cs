namespace FlowBudget.Services.Crypto;

public interface IDekProvider
{
    Task<byte[]> GetDekAsync(string userId, CancellationToken ct = default);
    void Evict(string userId);
}
