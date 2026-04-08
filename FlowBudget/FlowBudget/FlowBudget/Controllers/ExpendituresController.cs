using FlowBudget.Client.Components.DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

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
    }
}
