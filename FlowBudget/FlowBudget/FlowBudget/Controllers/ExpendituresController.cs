using DTO;
using FlowBudget.Client.Components.DTO;
using FlowBudget.Services;
using FlowBudget.Services.ExportStrategies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.EntityFrameworkCore;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ExpendituresController(ExpenditureService expenditureService) : ApiBaseController
    {
        [HttpPost("{pid}")]
        public async Task<ActionResult> AddExpenditure(string pid, [FromBody] CreateExpenditureDTO dto)
        {
            await expenditureService.AddExpenditure(UserId, pid, dto);
            return Created();
        }

        [HttpPut("{eid}")]
        public async Task<ActionResult> UpdateExpenditure(string eid, [FromBody] UpdateExpenditureDTO dto)
        {
            await expenditureService.UpdateExpenditure(UserId, eid, dto);
            return NoContent();
        }

        [HttpDelete("{eid}")]
        public async Task<ActionResult> DeleteExpenditure(string eid)
        {
            await expenditureService.RemoveExpenditure(UserId, eid);
            return NoContent();
        }
        
        [HttpGet]
        public async Task<ActionResult> Query(ODataQueryOptions<ExpenditureDTO> options)
        {
            var query = expenditureService.QueryForUser(UserId);
            var settings = new ODataQuerySettings();

            IQueryable<ExpenditureDTO> result = query;

            if (options.Filter != null)
                result = (IQueryable<ExpenditureDTO>)options.Filter.ApplyTo(result, settings);

            var count = await result.LongCountAsync();

            if (options.OrderBy != null)
                result = options.OrderBy.ApplyTo(result, settings);

            if (options.Skip != null)
                result = (IQueryable<ExpenditureDTO>)options.Skip.ApplyTo(result, settings);

            if (options.Top != null)
                result = (IQueryable<ExpenditureDTO>)options.Top.ApplyTo(result, settings);

            var items = await result.ToListAsync();
            return Ok(new { count, value = items });
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export(
            [FromBody] ExportParameterDTO dto,
            [FromServices] IEnumerable<IExportStrategy> strategies)
        {
            var strategy = strategies.FirstOrDefault(s =>
                string.Equals(s.Format, dto.ExportingFormat, StringComparison.OrdinalIgnoreCase));
            if (strategy == null)
                return BadRequest($"Unsupported format: {dto.ExportingFormat}");

            var stream = await strategy.ExportAsync(UserId, dto);
            var filename = $"flowbudget-export-{DateTime.UtcNow:yyyy-MM-dd-HHmmss}.{strategy.FileExtension}";
            return File(stream, strategy.ContentType, filename);
        }

        [HttpGet("stats")]
        public async Task<ActionResult<ExpenditureStatsDTO>> GetStats([FromQuery] string? accountId = null)
        {
            return await expenditureService.GetStats(UserId, accountId);
        }
    }
}
