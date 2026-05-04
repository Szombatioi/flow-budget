namespace FlowBudget.Models;

internal sealed class ChangelogFile
{
    public List<ChangelogEntry> Entries { get; set; } = [];
}

internal sealed class ChangelogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Category { get; set; } = "release";
}
