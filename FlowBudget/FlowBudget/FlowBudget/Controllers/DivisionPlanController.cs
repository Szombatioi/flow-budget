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
        
        
    }
}
