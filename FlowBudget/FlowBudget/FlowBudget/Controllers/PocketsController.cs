using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PocketsController(PocketService pocketService) : ApiBaseController
    {
        [HttpGet("{did}")]
        public async Task<ActionResult<List<PocketDTO>>> GetPockets(string did)
        {
            // Console.BackgroundColor = ConsoleColor.Yellow;
            // Console.WriteLine("xxxxxxxxxxxx");
            // Console.WriteLine(did);
            // Console.ResetColor();
            return await pocketService.GetAllPockets(UserId, did);
        }

        [HttpPost("{did}")]
        public async Task<ActionResult> AddPocket(string did, [FromBody] CreatePocketDTO dto, [FromQuery] DateTime? allowFrom = null)
        {
            await pocketService.AddPocket(UserId, did, dto, allowFrom);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> UpdatePocket([FromBody] EditPocketDTO dto, [FromQuery] DateTime allowFrom)
        {
            await pocketService.UpdatePocket(UserId, dto, allowFrom);
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeletePocket(string id)
        {
            await pocketService.DeletePocket(UserId, id);
            return NoContent();
        }
    }
}
