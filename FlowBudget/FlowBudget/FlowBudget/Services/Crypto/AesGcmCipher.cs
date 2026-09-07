using System.Security.Cryptography;
using System.Text;

namespace FlowBudget.Services.Crypto;

public static class AesGcmCipher
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static byte[] Encrypt(byte[] dek, string plaintext)
    {
        if (plaintext is null) throw new ArgumentNullException(nameof(plaintext));

        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var ciphertext = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(dek, TagSize);
        aes.Encrypt(nonce, plainBytes, ciphertext, tag);

        // Layout: nonce (12) || ciphertext || tag (16)
        var output = new byte[NonceSize + ciphertext.Length + TagSize];
        Buffer.BlockCopy(nonce, 0, output, 0, NonceSize);
        Buffer.BlockCopy(ciphertext, 0, output, NonceSize, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, output, NonceSize + ciphertext.Length, TagSize);
        return output;
    }

    public static string Decrypt(byte[] dek, byte[] blob)
    {
        if (blob is null || blob.Length < NonceSize + TagSize)
            throw new CryptographicException("Encrypted blob is malformed.");

        var nonce = new byte[NonceSize];
        var tag = new byte[TagSize];
        var ciphertextLen = blob.Length - NonceSize - TagSize;
        var ciphertext = new byte[ciphertextLen];

        Buffer.BlockCopy(blob, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(blob, NonceSize, ciphertext, 0, ciphertextLen);
        Buffer.BlockCopy(blob, NonceSize + ciphertextLen, tag, 0, TagSize);

        var plainBytes = new byte[ciphertextLen];
        using var aes = new AesGcm(dek, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, plainBytes);
        return Encoding.UTF8.GetString(plainBytes);
    }
}
