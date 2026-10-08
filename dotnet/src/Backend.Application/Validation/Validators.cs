using Backend.Application.Common;
using Backend.Application.Dtos;
using FluentValidation;

namespace Backend.Application.Validation;

public static class IncludeRules
{
    public static void Apply<T>(AbstractValidator<T> validator, params string[] allowed) where T : PageQuery
    {
        validator.RuleFor(x => x.Page)
            .Must(page => page is null or >= 1)
            .WithMessage("Page must be a positive integer.");

        validator.RuleFor(x => x.Limit)
            .Must(limit => limit is null || (limit >= 1 && limit <= PageLimits.MaxLimit))
            .WithMessage($"Limit must be an integer between 1 and {PageLimits.MaxLimit}.");

        validator.RuleFor(x => x.Order)
            .Must(order => string.IsNullOrWhiteSpace(order)
                || order.Equals("asc", StringComparison.OrdinalIgnoreCase)
                || order.Equals("desc", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Order must be either asc or desc.");

        validator.RuleFor(x => x.Include).Custom((value, context) =>
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            var parts = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var invalid = parts.Where(part => !allowed.Contains(part)).ToArray();
            if (invalid.Length == 0)
            {
                return;
            }

            context.AddFailure("include", $"Unsupported include value(s): {string.Join(", ", invalid)}. Allowed: {string.Join(", ", allowed)}.");
        });
    }
}

public sealed class RegisterValidator : AbstractValidator<RegisterRequest>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Name is required.")
            .Must(name => name!.Trim().Length is >= 2 and <= 100).WithMessage("Name must be between 2 and 100 characters.");

        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email is required.")
            .Must(email => email!.Trim().Length is >= 3 and <= 150).WithMessage("Email must be between 3 and 150 characters.")
            .EmailAddress().WithMessage("The email must be a valid email address.");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters long.")
            .MaximumLength(72).WithMessage("Password must be at least 8 characters long.");

        RuleFor(x => x.PasswordConfirmation)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("password_confirmation is required.")
            .Equal(x => x.Password).WithMessage("password_confirmation must match password.");
    }
}

public sealed class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("The email must be a valid email address.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.");
    }
}

public sealed class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Name is required.")
            .Must(name => name!.Trim().Length is >= 2 and <= 100).WithMessage("Name must be between 2 and 100 characters.");

        RuleFor(x => x.Email)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Email is required.")
            .Must(email => email!.Trim().Length is >= 3 and <= 150).WithMessage("Email must be between 3 and 150 characters.")
            .EmailAddress().WithMessage("The email must be a valid email address.");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters long.")
            .MaximumLength(72).WithMessage("Password must be at least 8 characters long.");

        RuleFor(x => x.Role)
            .Must(role => string.IsNullOrWhiteSpace(role) || ApiValues.Roles.Contains(role))
            .WithMessage($"Role must be one of: {string.Join(", ", ApiValues.Roles)}.");
    }
}

public sealed class UserListValidator : AbstractValidator<UserListQuery>
{
    public UserListValidator()
    {
        IncludeRules.Apply(this);
        RuleFor(x => x.Role)
            .Must(role => string.IsNullOrWhiteSpace(role) || ApiValues.Roles.Contains(role))
            .WithMessage($"Role must be one of: {string.Join(", ", ApiValues.Roles)}.");
    }
}

public sealed class CreateCategoryValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Name is required.")
            .Must(name => name!.Trim().Length is >= 2 and <= 100).WithMessage("Name must be between 2 and 100 characters.");

        RuleFor(x => x.Slug)
            .Must(slug => string.IsNullOrWhiteSpace(slug) || IsSlug(slug, 120))
            .WithMessage("Slug may only contain lowercase letters, numbers and single hyphens.");

        RuleFor(x => x.Description)
            .Must(value => value is null || value.Length <= 10000)
            .WithMessage("Description must be a string.");
    }

    internal static bool IsSlug(string slug, int max) =>
        slug.Trim().Length is >= 1 && slug.Trim().Length <= max && System.Text.RegularExpressions.Regex.IsMatch(slug.Trim(), "^[a-z0-9]+(?:-[a-z0-9]+)*$");
}

public sealed class CategoryListValidator : AbstractValidator<CategoryListQuery>
{
    public CategoryListValidator() => IncludeRules.Apply(this, "products");
}

public sealed class CreateTagValidator : AbstractValidator<CreateTagRequest>
{
    public CreateTagValidator()
    {
        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Name is required.")
            .Must(name => name!.Trim().Length is >= 2 and <= 60).WithMessage("Name must be between 2 and 60 characters.");

        RuleFor(x => x.Slug)
            .Must(slug => string.IsNullOrWhiteSpace(slug) || CreateCategoryValidator.IsSlug(slug, 80))
            .WithMessage("Slug may only contain lowercase letters, numbers and single hyphens.");
    }
}

public sealed class TagListValidator : AbstractValidator<TagListQuery>
{
    public TagListValidator() => IncludeRules.Apply(this, "products");
}

public sealed class CreateProductValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("category_id must be a positive integer.");

        RuleFor(x => x.Name)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Name is required.")
            .Must(name => name!.Trim().Length is >= 2 and <= 150).WithMessage("Name must be between 2 and 150 characters.");

        RuleFor(x => x.Slug)
            .Must(slug => string.IsNullOrWhiteSpace(slug) || CreateCategoryValidator.IsSlug(slug, 180))
            .WithMessage("Slug may only contain lowercase letters, numbers and single hyphens.");

        RuleFor(x => x.Price)
            .NotNull().WithMessage("Price is required.")
            .GreaterThanOrEqualTo(0).WithMessage("Price must be a number greater than or equal to 0.");

        RuleFor(x => x.Stock)
            .Must(stock => stock is null or >= 0)
            .WithMessage("Stock must be an integer greater than or equal to 0.");

        RuleFor(x => x.Tags)
            .Must(tags => tags is null || (tags.Count is >= 1 and <= 20 && tags.All(id => id > 0)))
            .WithMessage("tags must be an array of positive integers.");
    }
}

public sealed class ProductListValidator : AbstractValidator<ProductListQuery>
{
    public ProductListValidator()
    {
        IncludeRules.Apply(this, "category", "tags");
        RuleFor(x => x.CategoryId).Must(id => id is null or > 0).WithMessage("category_id must be a positive integer.");
        RuleFor(x => x.TagId).Must(id => id is null or > 0).WithMessage("tag_id must be a positive integer.");
        RuleFor(x => x.MinPrice).Must(price => price is null or >= 0).WithMessage("min_price must be a number greater than or equal to 0.");
        RuleFor(x => x.MaxPrice).Must(price => price is null or >= 0).WithMessage("max_price must be a number greater than or equal to 0.");
    }
}

public sealed class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Items).Custom((items, context) =>
        {
            if (items is null)
            {
                context.AddFailure("items", "Items is required.");
                return;
            }

            if (items.Count is < 1 or > 100)
            {
                context.AddFailure("items", "Items must be a non-empty array.");
                return;
            }

            for (var index = 0; index < items.Count; index++)
            {
                if (items[index].ProductId < 1)
                {
                    context.AddFailure($"items.{index}.product_id", $"items.{index}.product_id must be a positive integer.");
                }

                if (items[index].Quantity < 1)
                {
                    context.AddFailure($"items.{index}.quantity", $"items.{index}.quantity must be an integer greater than or equal to 1.");
                }
            }
        });
    }
}

public sealed class UpdateOrderStatusValidator : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusValidator()
    {
        RuleFor(x => x.Status)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Status is required.")
            .Must(status => status is not null && ApiValues.OrderStatuses.Contains(status))
            .WithMessage($"Status must be one of: {string.Join(", ", ApiValues.OrderStatuses)}.");
    }
}

public sealed class OrderListValidator : AbstractValidator<OrderListQuery>
{
    public OrderListValidator()
    {
        IncludeRules.Apply(this, "items", "items.product", "user");
        RuleFor(x => x.Status)
            .Must(status => string.IsNullOrWhiteSpace(status) || ApiValues.OrderStatuses.Contains(status))
            .WithMessage($"Status must be one of: {string.Join(", ", ApiValues.OrderStatuses)}.");
        RuleFor(x => x.UserId).Must(id => id is null or > 0).WithMessage("user_id must be a positive integer.");
    }
}

public sealed class CommentBodyValidator : AbstractValidator<CommentBodyRequest>
{
    public CommentBodyValidator()
    {
        RuleFor(x => x.Body)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Body is required.")
            .Must(body => body!.Trim().Length is >= 1 and <= 2000).WithMessage("Body must be between 1 and 2000 characters.");
    }
}

public sealed class CommentListValidator : AbstractValidator<CommentListQuery>
{
    public CommentListValidator()
    {
        IncludeRules.Apply(this, "user", "product");
        RuleFor(x => x.ProductId).Must(id => id is null or > 0).WithMessage("product_id must be a positive integer.");
        RuleFor(x => x.UserId).Must(id => id is null or > 0).WithMessage("user_id must be a positive integer.");
    }
}
