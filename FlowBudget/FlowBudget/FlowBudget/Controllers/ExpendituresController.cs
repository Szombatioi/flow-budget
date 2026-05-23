using FlowBudget.Client.Components.DTO;
using FlowBudget.Services;
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
        
        // The [EnableQuery] attribute on a non-OData-routed MVC action just returns
        // the array as JSON; the OData envelope ({@odata.count, value}) is never
        // produced because there's no MapODataRoute. We instead inject
        // ODataQueryOptions<T>, apply $filter/$orderby/$skip/$top ourselves, take a
        // post-filter pre-pagination count, and return a deterministic
        // { count, value } wrapper the client can rely on.
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

        [HttpGet("stats")]
        public async Task<ActionResult<ExpenditureStatsDTO>> GetStats()
        {
            return await expenditureService.GetStats(UserId);
        }
    }
}
