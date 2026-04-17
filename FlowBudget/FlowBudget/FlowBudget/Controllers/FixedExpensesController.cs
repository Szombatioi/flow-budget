using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Route("api/fixed-expenses")]
    [ApiController]
    public class FixedExpensesController(FixedExpenseService fixedExpenseService) : ApiBaseController
    {
        private readonly FixedExpenseService _fixedExpenseService = fixedExpenseService;

        [HttpGet("{aid}")]
        public async Task<ActionResult<List<FixedExpenseDTO>>> GetAll(string aid)
        {
            return await _fixedExpenseService.GetAllFixedExpensesForAccount(UserId, aid);
        }

        [HttpPost]
        public async Task<ActionResult> Post([FromBody] CreateFixedExpenseDTO dto)
        {
            await _fixedExpenseService.AddFixExpenditure(UserId, dto);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> Put([FromBody] EditFixedExpenseDTO dto, [FromQuery] DateTime allowFrom)
        {
            await _fixedExpenseService.UpdateFixExpenditure(UserId, dto, allowFrom);
            return Ok();
        }

        [HttpDelete("{feid}")]
        public async Task<ActionResult> Delete(string feid)
        {
            await _fixedExpenseService.DeleteFixedExpense(UserId, feid);
            return NoContent();
        }
    }
}
