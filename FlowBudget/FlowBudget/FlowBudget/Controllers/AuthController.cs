using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FlowBudget.Data.Models;
using FlowBudget.Data;
using FlowBudget.Services.Crypto;
using DTO;

namespace FlowBudget.Controllers
{
    [IgnoreAntiforgeryToken] //TODO: Temporary, remove to prevent use from curl
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        IKmsService kms,
        IDekProvider dekProvider) : ApiBaseController
    {
        private readonly SignInManager<ApplicationUser> _signInManager = signInManager;
        private readonly UserManager<ApplicationUser> _userManager = userManager;
        private readonly IKmsService _kms = kms;
        private readonly IDekProvider _dekProvider = dekProvider;
    
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] LoginDTO model)
        {
            //Login via username, fallback for email
            var user = await _userManager.FindByNameAsync(model.UsernameOrEmail)
                       ?? await _userManager.FindByEmailAsync(model.UsernameOrEmail);

            if (user?.UserName == null)
            {
                return Unauthorized("Invalid login attempt.");
            }

            var result = await _signInManager.PasswordSignInAsync(
                user.UserName,
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

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDTO model)
        {
            var user = new ApplicationUser
            {
                UserName = model.Username,
                Email = model.Email,
            };
            
            var result = await _userManager.CreateAsync(user, model.Password);

            if (result.Succeeded)
            {
                // Envelope encryption: generate a per-user DEK, wrap with KMS, persist.
                var dek = RandomNumberGenerator.GetBytes(32);
                user.WrappedDek = await _kms.WrapAsync(dek, _kms.CurrentKekVersion);
                user.KekVersion = _kms.CurrentKekVersion;
                user.DekCreatedAt = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);

                //Log in with Remember me = true
                await _signInManager.SignInAsync(user, isPersistent: true);

                return Ok(new { Message = "User registered and logged in." });
            }
            
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { Errors = errors });
        }
    
        [HttpPost("logout")]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> Logout()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
                _dekProvider.Evict(userId);

            await _signInManager.SignOutAsync();
            return Ok();
        }
    }
}
