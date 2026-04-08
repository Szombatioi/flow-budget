using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/daily-expenses")]
    [ApiController]
    public class DailyExpensesController(DailyExpenseService dailyExpenseService) : ApiBaseController
    {
        [HttpPost("{accountId}")]
        public async Task<ActionResult> CreateDailyExpensesForMonth(string accountId, [FromQuery] DateTime date)
        {
            await dailyExpenseService.CreateDailyExpenseForMonth(UserId, accountId, date);
            return Created();
        }

        [HttpGet("{pocketId}")]
        public async Task<ActionResult<DailyExpenseDTO>> GetDailyExpense(string pocketId, [FromQuery] DateTime date)
        {
            //date is an exact date, including days too
            return await dailyExpenseService.GetDailyExpense(UserId, pocketId, date);
        }
    }
}
