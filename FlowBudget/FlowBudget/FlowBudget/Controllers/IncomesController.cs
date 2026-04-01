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
        private readonly IncomeService _incomeService = incomeService;

        [HttpGet("{aid}")]
        public async Task<ActionResult<List<IncomeDTO>>> GetAll(string aid)
        {
            return await _incomeService.GetAllIncomes(UserId, aid);
        }

        [HttpPost]
        public async Task<ActionResult> Post([FromBody] CreateIncomeDTO dto)
        {
            await _incomeService.AddIncome(UserId, dto);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> Put([FromBody] EditIncomeDTO dto)
        {
            await _incomeService.UpdateIncome(UserId, dto);
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(string id)
        {
            await _incomeService.DeleteIncome(UserId, id);
            return NoContent();
        }
        
        // [HttpPost("range")]
        // public async Task<ActionResult> Post([FromBody] List<CreateIncomeDTO> dtos)
        // {
        //     
        // }
    }
}
