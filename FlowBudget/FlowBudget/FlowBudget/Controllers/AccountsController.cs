using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AccountsController(AccountService accountService) : ApiBaseController
    {
        private readonly AccountService _accountService = accountService;
        [HttpPost]
        public async Task<ActionResult> CreateAccount([FromBody] CreateAccountDTO dto)
        {
            await _accountService.CreateAccount(UserId, dto);
            return Created();
        }

        [HttpGet]
        public async Task<ActionResult<List<AccountDTO>>> GetAccounts()
        {
            return await _accountService.GetAccounts(UserId);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteAccount(string id)
        {
            await _accountService.DeleteAccount(UserId, id);
            return NoContent();
        }
    }
}
