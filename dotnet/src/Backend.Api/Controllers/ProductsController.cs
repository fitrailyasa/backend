using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductService _products;
    private readonly ICommentService _comments;

    public ProductsController(IProductService products, ICommentService comments)
    {
        _products = products;
        _comments = comments;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] ProductListQuery query, CancellationToken cancellationToken)
    {
        var page = await _products.ListAsync(query, cancellationToken);
        return ApiResults.Paginated("Products retrieved", page.Items, page.Meta);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, [FromQuery] string? include, CancellationToken cancellationToken) =>
        ApiResults.Ok("Product retrieved", await _products.GetAsync(RouteIds.Parse(id), include, cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request, CancellationToken cancellationToken) =>
        ApiResults.Created("Product created successfully", await _products.CreateAsync(request, cancellationToken));

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
        await _products.DeleteAsync(RouteIds.Parse(id), cancellationToken);
        return ApiResults.Ok<string?>("Product deleted successfully", null);
    }

    [HttpGet("{productId}/comments")]
    public async Task<IActionResult> Comments(string productId, [FromQuery] CommentListQuery query, CancellationToken cancellationToken)
    {
        var page = await _comments.ListByProductAsync(RouteIds.Parse(productId, "productId"), query, cancellationToken);
        return ApiResults.Paginated("Comments retrieved", page.Items, page.Meta);
    }

    [Authorize]
    [HttpPost("{productId}/comments")]
    public async Task<IActionResult> CreateComment(string productId, [FromBody] CommentBodyRequest request, CancellationToken cancellationToken)
    {
        var comment = await _comments.CreateAsync(RouteIds.Parse(productId, "productId"), request.Body!, CurrentUser.Id(User), cancellationToken);
        return ApiResults.Created("Comment created successfully", comment);
    }

    private async Task<IActionResult> Update(string id, JsonElement body, bool requireCore, CancellationToken cancellationToken)
    {
        WriteGuards.RequireObject(body);
        var request = WriteGuards.Product(body, requireCore);
        return ApiResults.Ok("Product updated successfully", await _products.UpdateAsync(RouteIds.Parse(id), request, cancellationToken));
    }
}
