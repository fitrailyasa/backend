using System.Text.Json;
using Backend.Application.Validation;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        ValidatorOptions.Global.PropertyNameResolver = (_, member, _) =>
            member is null ? null : JsonNamingPolicy.SnakeCaseLower.ConvertName(member.Name);

        services.AddValidatorsFromAssemblyContaining<RegisterValidator>();
        return services;
    }
}
