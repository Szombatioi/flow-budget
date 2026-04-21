using DTO;
using FlowBudget.Client.Components.DTO;
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

        [HttpPost("{pid}/receipt")]
        public async Task<ActionResult<List<ExpenditureReceiptItemDTO>>> UploadReceipt(string pid, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("file_missing.");
            return await dailyExpenseService.UploadReceipt(UserId, pid, file);
        }
    }
}
