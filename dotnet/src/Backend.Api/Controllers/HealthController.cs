using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var uptime = (DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalSeconds;
        return new JsonResult(new
        {
            status = "ok",
            uptime,
            timestamp = DateTime.UtcNow
        });
    }
}
