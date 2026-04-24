using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FlowBudget.Controllers;

[AllowAnonymous]
[Route("rss")]
[ApiController]
public class RssController(IWebHostEnvironment env, ILogger<RssController> logger) : ControllerBase
{
    // changelog.json lives in the Data/ directory (same Docker volume as the DB)
    // so entries can be added without rebuilding the image.
    private static readonly string ChangelogPath =
        Path.Combine("Data", "changelog.json");

    [HttpGet]
    public async Task<IActionResult> GetFeed()
    {
        var entries = await LoadEntries();

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var feedUrl = $"{baseUrl}/rss";
        var lastBuild = entries.Count > 0
            ? entries.Max(e => e.Date)
            : DateTime.UtcNow;

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">");
        sb.AppendLine("  <channel>");
        sb.AppendLine("    <title>FlowBudget – Updates &amp; Status</title>");
        sb.AppendLine($"    <link>{baseUrl}</link>");
        sb.AppendLine("    <description>Release notes and status updates for FlowBudget.</description>");
        sb.AppendLine("    <language>en-us</language>");
        sb.AppendLine($"    <lastBuildDate>{lastBuild:R}</lastBuildDate>");
        sb.AppendLine($"    <atom:link href=\"{feedUrl}\" rel=\"self\" type=\"application/rss+xml\"/>");

        foreach (var entry in entries.OrderByDescending(e => e.Date))
        {
            sb.AppendLine("    <item>");
            sb.AppendLine($"      <title>{Escape(entry.Title)}</title>");
            sb.AppendLine($"      <description>{Escape(entry.Description)}</description>");
            sb.AppendLine($"      <pubDate>{entry.Date:R}</pubDate>");
            sb.AppendLine($"      <guid isPermaLink=\"false\">{Escape(entry.Id)}</guid>");
            if (!string.IsNullOrWhiteSpace(entry.Category))
                sb.AppendLine($"      <category>{Escape(entry.Category)}</category>");
            sb.AppendLine("    </item>");
        }

        sb.AppendLine("  </channel>");
        sb.AppendLine("</rss>");

        return Content(sb.ToString(), "application/rss+xml", Encoding.UTF8);
    }

    private async Task<List<ChangelogEntry>> LoadEntries()
    {
        if (!System.IO.File.Exists(ChangelogPath))
        {
            logger.LogWarning("changelog.json not found at {Path} — serving empty feed", ChangelogPath);
            return [];
        }

        try
        {
            var json = await System.IO.File.ReadAllTextAsync(ChangelogPath);
            var doc = JsonSerializer.Deserialize<ChangelogFile>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return doc?.Entries ?? [];
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to parse changelog.json");
            return [];
        }
    }

    private static string Escape(string? text) =>
        (text ?? string.Empty)
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");

    private sealed class ChangelogFile
    {
        public List<ChangelogEntry> Entries { get; set; } = [];
    }

    private sealed class ChangelogEntry
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }

        [JsonConverter(typeof(JsonStringEnumConverter))]
        public string Category { get; set; } = "release";
    }
}
