using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ApiBaseController : ControllerBase
    {
        protected string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)
                                   ?? throw new InvalidOperationException("User ID not found in claims.");

        // Helper if you need the ID as a Guid
        protected Guid UserGuid => Guid.Parse(UserId);
    }
}
