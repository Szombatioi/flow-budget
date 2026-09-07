namespace FlowBudget.Services.Crypto;

public interface IKmsService
{
    int CurrentKekVersion { get; }
    Task<byte[]> WrapAsync(byte[] dek, int kekVersion, CancellationToken ct = default);
    Task<byte[]> UnwrapAsync(byte[] wrappedDek, int kekVersion, CancellationToken ct = default);
}
