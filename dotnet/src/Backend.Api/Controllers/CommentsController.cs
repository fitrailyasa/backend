using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/comments")]
public sealed class CommentsController : ControllerBase
{
    private readonly ICommentService _comments;

    public CommentsController(ICommentService comments) => _comments = comments;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] CommentListQuery query, CancellationToken cancellationToken)
    {
        var page = await _comments.ListAsync(query, cancellationToken);
        return ApiResults.Paginated("Comments retrieved", page.Items, page.Meta);
    }

    [Authorize]
    [HttpPatch("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] CommentBodyRequest request, CancellationToken cancellationToken) =>
        ApiResults.Ok("Comment updated successfully", await _comments.UpdateAsync(RouteIds.Parse(id), request.Body!, CurrentUser.Id(User), CurrentUser.Role(User), cancellationToken));

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await _comments.DeleteAsync(RouteIds.Parse(id), CurrentUser.Id(User), CurrentUser.Role(User), cancellationToken);
        return ApiResults.Ok<string?>("Comment deleted successfully", null);
    }
}
