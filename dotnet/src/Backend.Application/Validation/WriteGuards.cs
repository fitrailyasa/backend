using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Application.Common;
using Backend.Application.Dtos;

namespace Backend.Application.Validation;

public static class WriteGuards
{
    private static readonly Regex SlugPattern = new("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static CategoryWriteRequest Category(JsonElement body, bool requireName)
    {
        var request = new CategoryWriteRequest
        {
            Name = ReadString(body, "name"),
            Slug = ReadString(body, "slug"),
            Description = ReadString(body, "description"),
            RequireName = requireName
        };
        ValidateCategory(request);
        return request;
    }

    public static TagWriteRequest Tag(JsonElement body, bool requireName)
    {
        var request = new TagWriteRequest
        {
            Name = ReadString(body, "name"),
            Slug = ReadString(body, "slug"),
            RequireName = requireName
        };
        ValidateTag(request);
        return request;
    }

    public static ProductWriteRequest Product(JsonElement body, bool requireCore)
    {
        var request = new ProductWriteRequest
        {
            CategoryId = ReadInt64(body, "category_id"),
            Name = ReadString(body, "name"),
            Slug = ReadString(body, "slug"),
            Description = ReadString(body, "description"),
            Price = ReadDecimal(body, "price"),
            Stock = ReadInt32(body, "stock"),
            Tags = ReadTags(body),
            RequireCore = requireCore
        };
        ValidateProduct(request);
        return request;
    }

    public static UserWriteRequest User(JsonElement body, bool requireCore, bool isProfile)
    {
        var request = new UserWriteRequest
        {
            Name = ReadString(body, "name"),
            Email = ReadString(body, "email"),
            Password = ReadString(body, "password"),
            PasswordConfirmation = ReadString(body, "password_confirmation"),
            Role = isProfile ? null : ReadString(body, "role"),
            IsProfile = isProfile,
            RequireCore = requireCore
        };
        ValidateUser(request);
        return request;
    }

    public static void RequireObject(JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
        {
            throw AppException.BadRequest("Invalid JSON payload");
        }
    }

    private static void ValidateCategory(CategoryWriteRequest request)
    {
        var errors = new Dictionary<string, List<string>>();
        if (request.RequireName && request.Name is null or { IsNull: true })
        {
            Add(errors, "name", "Name is required.");
        }

        ValidateName(errors, request.Name, 2, 100);
        ValidateSlug(errors, request.Slug, 120);
        if (errors.Count > 0)
        {
            throw AppException.Validation(ToArray(errors));
        }
    }

    private static void ValidateTag(TagWriteRequest request)
    {
        var errors = new Dictionary<string, List<string>>();
        if (request.RequireName && request.Name is null or { IsNull: true })
        {
            Add(errors, "name", "Name is required.");
        }

        ValidateName(errors, request.Name, 2, 60);
        ValidateSlug(errors, request.Slug, 80);
        if (errors.Count > 0)
        {
            throw AppException.Validation(ToArray(errors));
        }
    }

    private static void ValidateProduct(ProductWriteRequest request)
    {
        var errors = new Dictionary<string, List<string>>();
        if (request.RequireCore && (request.CategoryId is null || request.CategoryId.IsNull))
        {
            Add(errors, "category_id", "category_id is required.");
        }

        if (request.CategoryId is { IsNull: false } category && category.Value < 1)
        {
            Add(errors, "category_id", "category_id must be a positive integer.");
        }

        if (request.RequireCore && request.Name is null or { IsNull: true })
        {
            Add(errors, "name", "Name is required.");
        }

        ValidateName(errors, request.Name, 2, 150);
        ValidateSlug(errors, request.Slug, 180);

        if (request.RequireCore && (request.Price is null || request.Price.IsNull))
        {
            Add(errors, "price", "Price is required.");
        }

        if (request.Price is { IsNull: false, Value: < 0 })
        {
            Add(errors, "price", "Price must be a number greater than or equal to 0.");
        }

        if (request.Stock is { IsNull: false, Value: < 0 })
        {
            Add(errors, "stock", "Stock must be an integer greater than or equal to 0.");
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation(ToArray(errors));
        }
    }

    private static void ValidateUser(UserWriteRequest request)
    {
        var errors = new Dictionary<string, List<string>>();
        if (request.RequireCore && request.Name is null or { IsNull: true })
        {
            Add(errors, "name", "Name is required.");
        }

        ValidateName(errors, request.Name, 2, 100);

        if (request.RequireCore && request.Email is null or { IsNull: true })
        {
            Add(errors, "email", "Email is required.");
        }

        if (request.Email is { IsNull: false, Value: { } email })
        {
            var trimmed = email.Trim();
            if (trimmed.Length is < 3 or > 150)
            {
                Add(errors, "email", "Email must be between 3 and 150 characters.");
            }
            else if (!IsEmail(trimmed))
            {
                Add(errors, "email", "The email must be a valid email address.");
            }
        }

        if (request.RequireCore && (request.Password is null || request.Password.IsNull || string.IsNullOrEmpty(request.Password.Value)))
        {
            Add(errors, "password", "Password is required.");
        }

        if (request.Password is { IsNull: false, Value: { } password } && password.Length is < 8 or > 72)
        {
            Add(errors, "password", "Password must be at least 8 characters long.");
        }

        if (!request.IsProfile && request.Role is { IsNull: false, Value: { } role } && !ApiValues.Roles.Contains(role))
        {
            Add(errors, "role", $"Role must be one of: {string.Join(", ", ApiValues.Roles)}.");
        }

        if (request.IsProfile && request.PasswordConfirmation is { IsNull: false })
        {
            if (request.Password is null || request.Password.IsNull || string.IsNullOrEmpty(request.Password.Value))
            {
                Add(errors, "password_confirmation", "Password is required when password_confirmation is provided.");
            }
            else if (request.PasswordConfirmation.Value != request.Password.Value)
            {
                Add(errors, "password_confirmation", "password_confirmation must match password.");
            }
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation(ToArray(errors));
        }
    }

    private static void ValidateName(Dictionary<string, List<string>> errors, Provided<string>? name, int min, int max)
    {
        if (name is not { IsNull: false, Value: { } value })
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(value))
        {
            Add(errors, "name", "Name is required.");
            return;
        }

        if (value.Trim().Length < min || value.Trim().Length > max)
        {
            Add(errors, "name", $"Name must be between {min} and {max} characters.");
        }
    }

    private static void ValidateSlug(Dictionary<string, List<string>> errors, Provided<string>? slug, int max)
    {
        if (slug is not { IsNull: false, Value: { } value })
        {
            return;
        }

        var trimmed = value.Trim();
        if (trimmed.Length is < 1 || trimmed.Length > max || !SlugPattern.IsMatch(trimmed))
        {
            Add(errors, "slug", "Slug may only contain lowercase letters, numbers and single hyphens.");
        }
    }

    private static Provided<string>? ReadString(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return new Provided<string>(null, true);
        }

        if (property.ValueKind != JsonValueKind.String)
        {
            throw AppException.Validation(name, $"{Label(name)} must be a string.");
        }

        return new Provided<string>(property.GetString(), false);
    }

    private static Provided<long>? ReadInt64(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return new Provided<long>(0, true);
        }

        if (property.ValueKind != JsonValueKind.Number || !property.TryGetInt64(out var value))
        {
            throw AppException.Validation(name, $"{name} must be a positive integer.");
        }

        return new Provided<long>(value, false);
    }

    private static Provided<int>? ReadInt32(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return new Provided<int>(0, true);
        }

        if (property.ValueKind != JsonValueKind.Number || !property.TryGetInt32(out var value))
        {
            throw AppException.Validation(name, "Stock must be an integer greater than or equal to 0.");
        }

        return new Provided<int>(value, false);
    }

    private static Provided<decimal>? ReadDecimal(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return new Provided<decimal>(0, true);
        }

        if (property.ValueKind != JsonValueKind.Number || !property.TryGetDecimal(out var value))
        {
            throw AppException.Validation(name, "Price must be a number greater than or equal to 0.");
        }

        return new Provided<decimal>(value, false);
    }

    private static Provided<List<long>>? ReadTags(JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("tags", out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return new Provided<List<long>>(null, true);
        }

        if (property.ValueKind != JsonValueKind.Array)
        {
            throw AppException.Validation("tags", "tags must be an array of tag ids.");
        }

        var ids = new List<long>();
        foreach (var entry in property.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Number || !entry.TryGetInt64(out var id) || id < 1)
            {
                throw AppException.Validation("tags", "tags must be an array of positive integers.");
            }

            ids.Add(id);
        }

        if (ids.Count is < 1 or > 20)
        {
            throw AppException.Validation("tags", "tags must be an array of tag ids.");
        }

        return new Provided<List<long>>(ids, false);
    }

    private static string Label(string name) => name switch
    {
        "name" => "Name",
        "email" => "Email",
        "password" => "Password",
        "description" => "Description",
        "slug" => "Slug",
        "body" => "Body",
        "status" => "Status",
        "role" => "Role",
        _ => name
    };

    private static bool IsEmail(string value)
    {
        try
        {
            var address = new MailAddress(value);
            return address.Address == value && value.Contains('@', StringComparison.Ordinal);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static void Add(Dictionary<string, List<string>> errors, string key, string message)
    {
        if (!errors.TryGetValue(key, out var list))
        {
            list = [];
            errors[key] = list;
        }

        if (!list.Contains(message))
        {
            list.Add(message);
        }
    }

    private static Dictionary<string, string[]> ToArray(Dictionary<string, List<string>> errors) =>
        errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray());
}
