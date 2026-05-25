using DTO;

namespace FlowBudget.Services.ExportStrategies;

public interface IExportStrategy
{
    string Format { get; }
    string ContentType { get; }
    string FileExtension { get; }

    Task<Stream> ExportAsync(string userId, ExportParameterDTO dto);
}
