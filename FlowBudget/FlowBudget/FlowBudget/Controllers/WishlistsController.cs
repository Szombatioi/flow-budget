using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers;

[Authorize]
[Route("api/wishlists")]
[ApiController]
public class WishlistsController(WishlistService wishlistService) : ApiBaseController
{
    [HttpGet]
    public async Task<ActionResult<List<WishlistDTO>>> GetAll()
        => await wishlistService.GetAll(UserId);

    [HttpGet("{id}")]
    public async Task<ActionResult<WishlistDTO>> Get(string id)
        => await wishlistService.Get(UserId, id);

    [HttpPost]
    public async Task<ActionResult<WishlistDTO>> Create([FromBody] CreateWishlistDTO dto)
        => Created(string.Empty, await wishlistService.Create(UserId, dto));

    [HttpPost("{id}/activate")]
    public async Task<ActionResult> Activate(string id)
    {
        await wishlistService.Activate(UserId, id);
        return NoContent();
    }

    [HttpPost("{id}/deactivate")]
    public async Task<ActionResult> Deactivate(string id)
    {
        await wishlistService.Deactivate(UserId, id);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        await wishlistService.Delete(UserId, id);
        return NoContent();
    }
    
    [HttpPost("{wishlistId}/align/{dailyExpenseId}")]
    public async Task<ActionResult> Align(string wishlistId, string dailyExpenseId)
    {
        await wishlistService.Align(UserId, dailyExpenseId, wishlistId);
        return NoContent();
    }

    [HttpDelete("align/{dailyExpenseId}")]
    public async Task<ActionResult> Unalign(string dailyExpenseId)
    {
        await wishlistService.Unalign(UserId, dailyExpenseId);
        return NoContent();
    }

    // The service throws InvalidOperationException with a translatable key
    // (e.g. "wishlist_inactive"). Surface the key as a plain-text 400 body so the
    // UI can look it up via the localizer.
    [HttpPost("move/{wishlistId}/{pocketId}")]
    public async Task<ActionResult> MoveMoneyToWishlist(string pocketId, string wishlistId, MoveMoneyDTO dto)
    {
        try
        {
            await wishlistService.MoveMoneyToWishlist(UserId, pocketId, wishlistId, dto);
            return Created();
        }
        catch (InvalidOperationException ex)
        {
            return new ContentResult { Content = ex.Message, ContentType = "text/plain", StatusCode = 400 };
        }
    }
}
