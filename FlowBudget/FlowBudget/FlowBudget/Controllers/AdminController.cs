using DTO;
using FlowBudget.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace FlowBudget.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/admin")]
[ApiController]
public class AdminController(ILogger<AdminController> logger) : ApiBaseController
{
    // Semaphore prevents concurrent writes corrupting the JSON file
    private static readonly SemaphoreSlim FileLock = new(1, 1);

    private static readonly JsonSerializerOptions ReadOptions =
        new() { PropertyNameCaseInsensitive = true };

    private static readonly JsonSerializerOptions WriteOptions =
        new() { WriteIndented = true };

    [HttpPost("rss")]
    public async Task<IActionResult> AddRssEntry([FromBody] RssEntryDTO entry)
    {
        if (string.IsNullOrWhiteSpace(entry.Title))
            return BadRequest(new { error = "Title is required." });
        if (string.IsNullOrWhiteSpace(entry.Description))
            return BadRequest(new { error = "Description is required." });

        await FileLock.WaitAsync();
        try
        {
            ChangelogFile changelog;

            if (System.IO.File.Exists(RssController.ChangelogPath))
            {
                var json = await System.IO.File.ReadAllTextAsync(RssController.ChangelogPath);
                changelog = JsonSerializer.Deserialize<ChangelogFile>(json, ReadOptions) ?? new ChangelogFile();
            }
            else
            {
                Directory.CreateDirectory("Data");
                changelog = new ChangelogFile();
            }

            var newEntry = new ChangelogEntry
            {
                Id = string.IsNullOrWhiteSpace(entry.Id) ? Guid.NewGuid().ToString() : entry.Id,
                Title = entry.Title,
                Description = entry.Description,
                Date = entry.Date == default ? DateTime.UtcNow : entry.Date,
                Category = string.IsNullOrWhiteSpace(entry.Category) ? "release" : entry.Category
            };

            // Newest entry first
            changelog.Entries.Insert(0, newEntry);

            var updated = JsonSerializer.Serialize(changelog, WriteOptions);
            await System.IO.File.WriteAllTextAsync(RssController.ChangelogPath, updated);

            logger.LogInformation("Admin {UserId} published RSS entry [{Id}]: {Title}", UserId, newEntry.Id, newEntry.Title);
            return Ok(new { id = newEntry.Id });
        }
        finally
        {
            FileLock.Release();
        }
    }
}
