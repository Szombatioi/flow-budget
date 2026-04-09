using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using FlowBudget.Data.Models;
using FlowBudget.Data;
using DTO;

namespace FlowBudget.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(SignInManager<ApplicationUser> signInManager, UserManager<ApplicationUser> userManager) : ApiBaseController
    {
        private readonly SignInManager<ApplicationUser> _signInManager = signInManager;
        private readonly UserManager<ApplicationUser> _userManager = userManager;
    
        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] LoginDTO model)
        {
            // 1. PasswordSignInAsync handles hashing, lockout, and cookie creation
            var result = await _signInManager.PasswordSignInAsync(
                model.Email, 
                model.Password, 
                model.RememberMe, 
                lockoutOnFailure: false);
    
            if (result.Succeeded)
            {
                return Ok(new { Message = "Logged in successfully" });
            }
    
            if (result.IsLockedOut)
            {
                return BadRequest("Account locked.");
            }
    
            return Unauthorized("Invalid login attempt.");
        }
    
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDTO model)
        {
            var user = new ApplicationUser
            {
                UserName = model.Username,
                Email = model.Email,
            };
        
            // 2. Create the user (this hashes the password automatically)
            var result = await _userManager.CreateAsync(user, model.Password);
        
            if (result.Succeeded)
            {
                // 3. Optional: Automatically sign them in after successful registration
                await _signInManager.SignInAsync(user, isPersistent: false);
                
                return Ok(new { Message = "User registered and logged in." });
            }
        
            // 4. If failed, return the specific Identity errors (e.g., Password too weak, Email taken)
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { Errors = errors });
        }
    
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return Ok();
        }
    }
}
