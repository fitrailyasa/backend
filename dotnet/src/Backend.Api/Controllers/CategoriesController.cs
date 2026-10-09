using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/categories")]
public sealed class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categories;

    public CategoriesController(ICategoryService categories) => _categories = categories;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] CategoryListQuery query, CancellationToken cancellationToken)
    {
        var page = await _categories.ListAsync(query, cancellationToken);
        return ApiResults.Paginated("Categories retrieved", page.Items, page.Meta);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, [FromQuery] string? include, CancellationToken cancellationToken) =>
        ApiResults.Ok("Category retrieved", await _categories.GetAsync(RouteIds.Parse(id), include, cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request, CancellationToken cancellationToken) =>
        ApiResults.Created("Category created successfully", await _categories.CreateAsync(request, cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpPut("{id}")]
    public Task<IActionResult> Put(string id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Update(id, body, true, cancellationToken);

    [Authorize(Roles = "admin")]
    [HttpPatch("{id}")]
    public Task<IActionResult> Patch(string id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Update(id, body, false, cancellationToken);

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await _categories.DeleteAsync(RouteIds.Parse(id), cancellationToken);
        return ApiResults.Ok<string?>("Category deleted successfully", null);
    }

    private async Task<IActionResult> Update(string id, JsonElement body, bool requireName, CancellationToken cancellationToken)
    {
        WriteGuards.RequireObject(body);
        var request = WriteGuards.Category(body, requireName);
        return ApiResults.Ok("Category updated successfully", await _categories.UpdateAsync(RouteIds.Parse(id), request, cancellationToken));
    }
}
