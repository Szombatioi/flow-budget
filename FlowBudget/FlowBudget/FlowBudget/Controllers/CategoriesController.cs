using DTO;
using FlowBudget.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlowBudget.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController(CategoryService categoryService) : ApiBaseController
    {
        [HttpGet]
        public async Task<ActionResult<List<CategoryDTO>>> GetAll()
        {
            return await categoryService.GetAllCategories(UserId);
        }

        [HttpPost]
        public async Task<ActionResult> Post([FromBody] CreateCategoryDTO dto)
        {
            await categoryService.CreateCategory(UserId, dto);
            return Created();
        }

        [HttpPut]
        public async Task<ActionResult> Put([FromBody] EditCategoryDTO dto)
        {
            await categoryService.UpdateCategory(UserId, dto);
            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(string id)
        {
            await categoryService.DeleteCategory(UserId, id);
            return NoContent();
        }
    }
}
