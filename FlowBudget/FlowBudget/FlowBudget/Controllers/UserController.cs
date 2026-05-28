using System.Security.Claims;
using DTO;
using FlowBudget.Services;
using FlowBudget.Services.Exceptions;
using Microsoft.AspNetCore.Authorization;
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
        
        [HttpGet]
        public async Task<ActionResult<UserBaseDTO>> Get()
        {
            return await _userService.Get(UserId);
        }
        
        [HttpGet("settings")]
        public async Task<ActionResult<UserSettingsDTO>> GetSettings()
        {
            try { return await _userService.GetSettings(UserId); }
            catch (NotFoundException) { return NotFound(); }
        }
        
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDTO dto)
        {
            try
            {
                await _userService.UpdateProfile(UserId, dto);
                return NoContent();
            }
            catch (NotFoundException) { return NotFound(); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }
        
        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDTO dto)
        {
            try
            {
                await _userService.ChangePassword(UserId, dto);
                return NoContent();
            }
            catch (NotFoundException) { return NotFound(); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }
        
        [HttpPut("preferences")]
        public async Task<IActionResult> UpdatePreferences([FromBody] UpdatePreferencesDTO dto)
        {
            try
            {
                await _userService.UpdatePreferences(UserId, dto);
                return NoContent();
            }
            catch (NotFoundException) { return NotFound(); }
        }
        
        [HttpPost("api-key/reveal")]
        public async Task<ActionResult<string?>> RevealApiKey([FromBody] RevealApiKeyDTO dto)
        {
            try { return await _userService.RevealApiKey(UserId, dto); }
            catch (NotFoundException) { return NotFound(); }
            catch (UnauthorizedAccessException) { return Unauthorized("invalid_password"); }
        }
        
        [HttpPut("api-key")]
        public async Task<IActionResult> UpdateApiKey([FromBody] UpdateApiKeyDTO dto)
        {
            try
            {
                await _userService.UpdateApiKey(UserId, dto);
                return NoContent();
            }
            catch (NotFoundException) { return NotFound(); }
            catch (UnauthorizedAccessException) { return Unauthorized("invalid_password"); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }
    }
}
