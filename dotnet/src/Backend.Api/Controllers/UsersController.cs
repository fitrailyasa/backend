using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
public sealed class UsersController : ControllerBase
{
    private readonly IUserService _users;

    public UsersController(IUserService users) => _users = users;

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken) =>
        ApiResults.Ok("User retrieved", await _users.GetAsync(CurrentUser.Id(User), cancellationToken));

    [Authorize]
    [HttpPatch("me")]
    public async Task<IActionResult> UpdateMe([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        WriteGuards.RequireObject(body);
        var request = WriteGuards.User(body, requireCore: false, isProfile: true);
        var user = await _users.UpdateAsync(CurrentUser.Id(User), request, cancellationToken);
        return ApiResults.Ok("Profile updated successfully", user);
    }

    [Authorize(Roles = "admin")]
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] UserListQuery query, CancellationToken cancellationToken)
    {
        var page = await _users.ListAsync(query, cancellationToken);
        return ApiResults.Paginated("Users retrieved", page.Items, page.Meta);
    }

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken) =>
        ApiResults.Created("User created successfully", await _users.CreateAsync(request, cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken cancellationToken) =>
        ApiResults.Ok("User retrieved", await _users.GetAsync(RouteIds.Parse(id), cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpPut("{id}")]
    public Task<IActionResult> Put(string id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Update(id, body, requireCore: true, cancellationToken);

    [Authorize(Roles = "admin")]
    [HttpPatch("{id}")]
    public Task<IActionResult> Patch(string id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Update(id, body, requireCore: false, cancellationToken);

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await _users.DeleteAsync(RouteIds.Parse(id), cancellationToken);
        return ApiResults.Ok<string?>("User deleted successfully", null);
    }

    private async Task<IActionResult> Update(string id, JsonElement body, bool requireCore, CancellationToken cancellationToken)
    {
        WriteGuards.RequireObject(body);
        var request = WriteGuards.User(body, requireCore, isProfile: false);
        var user = await _users.UpdateAsync(RouteIds.Parse(id), request, cancellationToken);
        return ApiResults.Ok("User updated successfully", user);
    }
}
