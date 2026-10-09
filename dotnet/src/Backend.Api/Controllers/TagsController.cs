using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/tags")]
public sealed class TagsController : ControllerBase
{
    private readonly ITagService _tags;

    public TagsController(ITagService tags) => _tags = tags;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] TagListQuery query, CancellationToken cancellationToken)
    {
        var page = await _tags.ListAsync(query, cancellationToken);
        return ApiResults.Paginated("Tags retrieved", page.Items, page.Meta);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, [FromQuery] string? include, CancellationToken cancellationToken) =>
        ApiResults.Ok("Tag retrieved", await _tags.GetAsync(RouteIds.Parse(id), include, cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTagRequest request, CancellationToken cancellationToken) =>
        ApiResults.Created("Tag created successfully", await _tags.CreateAsync(request, cancellationToken));

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
        await _tags.DeleteAsync(RouteIds.Parse(id), cancellationToken);
        return ApiResults.Ok<string?>("Tag deleted successfully", null);
    }

    private async Task<IActionResult> Update(string id, JsonElement body, bool requireName, CancellationToken cancellationToken)
    {
        WriteGuards.RequireObject(body);
        var request = WriteGuards.Tag(body, requireName);
        return ApiResults.Ok("Tag updated successfully", await _tags.UpdateAsync(RouteIds.Parse(id), request, cancellationToken));
    }
}
