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

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;

    public OrdersController(IOrderService orders) => _orders = orders;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] OrderListQuery query, CancellationToken cancellationToken)
    {
        var page = await _orders.ListAsync(query, CurrentUser.Id(User), CurrentUser.Role(User), cancellationToken);
        return ApiResults.Paginated("Orders retrieved", page.Items, page.Meta);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request, CancellationToken cancellationToken) =>
        ApiResults.Created("Order created successfully", await _orders.CreateAsync(request, CurrentUser.Id(User), cancellationToken));

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, [FromQuery] string? include, CancellationToken cancellationToken) =>
        ApiResults.Ok("Order retrieved", await _orders.GetAsync(RouteIds.Parse(id), include, CurrentUser.Id(User), CurrentUser.Role(User), cancellationToken));

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> Status(string id, [FromBody] UpdateOrderStatusRequest request, CancellationToken cancellationToken) =>
        ApiResults.Ok("Order status updated successfully", await _orders.UpdateStatusAsync(RouteIds.Parse(id), request.Status!, CurrentUser.Id(User), CurrentUser.Role(User), cancellationToken));

    [Authorize(Roles = "admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        await _orders.DeleteAsync(RouteIds.Parse(id), CurrentUser.Role(User), cancellationToken);
        return ApiResults.Ok<string?>("Order deleted successfully", null);
    }
}

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
