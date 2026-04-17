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
        private readonly PocketService _pocketService = pocketService;

        [HttpGet("{did}")]
        public async Task<ActionResult<List<PocketDTO>>> GetPockets(string did)
        {
            // Console.BackgroundColor = ConsoleColor.Yellow;
            // Console.WriteLine("xxxxxxxxxxxx");
            // Console.WriteLine(did);
            // Console.ResetColor();
            return await _pocketService.GetAllPockets(UserId, did);
        }

        [HttpPost("{did}")]
        public async Task<ActionResult> AddPocket(string did, [FromBody] CreatePocketDTO dto)
        {
            await _pocketService.AddPocket(UserId, did, dto);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> UpdatePocket([FromBody] EditPocketDTO dto, [FromQuery] DateTime allowFrom)
        {
            await _pocketService.UpdatePocket(UserId, dto, allowFrom);
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeletePocket(string id)
        {
            await _pocketService.DeletePocket(UserId, id);
            return NoContent();
        }
    }
}
