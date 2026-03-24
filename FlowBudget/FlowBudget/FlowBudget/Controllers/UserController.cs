using System.Security.Claims;
using DTO;
using FlowBudget.Services;
using FlowBudget.Services.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ApiBaseController
    {
        private readonly UserService _userService;
        public UserController(UserService userService)
        {
            _userService = userService;
        }
        //Get user with basic info (Accounts, ...)
        [HttpGet]
        public async Task<ActionResult<UserBaseDTO>> Get()
        {
            return await _userService.Get(UserGuid);
        }
    }
}