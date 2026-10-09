using System.Text.Json;
using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Dtos;
using Backend.Application.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

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
