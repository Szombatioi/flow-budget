using DTO;
using FlowBudget.Data.Models;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/currencies")]
    [ApiController]
    public class CurrencyController(CurrencyService currencyService) : ControllerBase
    {
        private readonly CurrencyService currencyService = currencyService;

        [HttpGet]
        public async Task<ActionResult<CurrencyDTO>> GetAll()
        {
            var result =  await currencyService.GetAllCurrencies();
            return Ok(result);
        }
    }
}
