using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Route("api/plans")]
    [ApiController]
    public class DivisionPlanController(DivisionPlanService dp) : ApiBaseController
    {
        private readonly DivisionPlanService _divisionPlanService = dp;

        [HttpGet("{aid}")]
        public async Task<ActionResult<List<DivisionPlanDTO>>> Get(string aid)
        {
            var res = await _divisionPlanService.GetAllForAccount(UserId, aid);
            return Ok(res);
        }
        
        [HttpPost]
        public async Task<ActionResult> Post([FromBody] CreateDivisionPlanDTO dto)
        {
            await _divisionPlanService.Create(UserId, dto);
            return Created();
        }
        
        [HttpPost("{id}/activate")]
        public async Task<ActionResult> Activate(string id, [FromQuery] DateTime activateFrom)
        {
            try
            {
                await _divisionPlanService.Activate(UserId, id, activateFrom);
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(string id)
        {
            try
            {
                await _divisionPlanService.Delete(UserId, id);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
        }
    }
}
