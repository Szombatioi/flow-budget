using DTO;
using FlowBudget.Services;
using Humanizer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class IncomesController(IncomeService incomeService) : ApiBaseController
    {
        [HttpGet("{aid}")]
        public async Task<ActionResult<List<IncomeDTO>>> GetAll(string aid)
        {
            return await incomeService.GetAllIncomes(UserId, aid);
        }

        [HttpPost]
        public async Task<ActionResult> Post([FromBody] CreateIncomeDTO dto)
        {
            await incomeService.AddIncome(UserId, dto);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> Put([FromBody] EditIncomeDTO dto, [FromQuery] DateTime allowFrom)
        {
            await incomeService.UpdateIncome(UserId, dto, allowFrom);
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(string id)
        {
            await incomeService.DeleteIncome(UserId, id);
            return NoContent();
        }
        
    }
}
