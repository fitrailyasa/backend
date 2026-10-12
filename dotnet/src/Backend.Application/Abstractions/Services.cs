using Backend.Application.Common;
using Backend.Application.Dtos;

namespace Backend.Application.Abstractions;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string passwordHash);
}

public interface IJwtTokenService
{
    (string Token, string RefreshToken, int ExpiresIn) IssuePair(long userId, string role);
    string? ReadTokenType(string token);
    AccessPrincipal ValidateRefreshToken(string token);
}

public interface ITokenBlacklist
{
    void Revoke(string jti, DateTimeOffset expiresAt);
    bool IsRevoked(string jti);
}

public interface IAuthService
{
    Task<AuthResultDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);
    Task<AuthResultDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
    Task<AuthResultDto> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task LogoutAsync(string? jti, DateTimeOffset? expiresAt, CancellationToken cancellationToken);
    Task<UserDto> MeAsync(long userId, CancellationToken cancellationToken);
}

public interface ILoginAttemptService
{
    // Returns 0 when the attempt is allowed, otherwise the seconds to wait (>= 1).
    int RetryAfter(string email, string clientIp);
    void RecordFailure(string email, string clientIp);
    void Reset(string email);
    void Reset();
}

public interface IUserService
{
    Task<PagedResult<UserDto>> ListAsync(UserListQuery query, CancellationToken cancellationToken);
    Task<UserDto> GetAsync(long id, CancellationToken cancellationToken);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken);
    Task<UserDto> UpdateAsync(long id, UserWriteRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
}

public interface ICategoryService
{
    Task<PagedResult<CategoryDto>> ListAsync(CategoryListQuery query, CancellationToken cancellationToken);
    Task<CategoryDto> GetAsync(long id, string? include, CancellationToken cancellationToken);
    Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken);
    Task<CategoryDto> UpdateAsync(long id, CategoryWriteRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
}

public interface ITagService
{
    Task<PagedResult<TagDto>> ListAsync(TagListQuery query, CancellationToken cancellationToken);
    Task<TagDto> GetAsync(long id, string? include, CancellationToken cancellationToken);
    Task<TagDto> CreateAsync(CreateTagRequest request, CancellationToken cancellationToken);
    Task<TagDto> UpdateAsync(long id, TagWriteRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
}

public interface IProductService
{
    Task<PagedResult<ProductDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken);
    Task<ProductDto> GetAsync(long id, string? include, CancellationToken cancellationToken);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken);
    Task<ProductDto> UpdateAsync(long id, ProductWriteRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
}

public interface IOrderService
{
    Task<PagedResult<OrderDto>> ListAsync(OrderListQuery query, long userId, string role, CancellationToken cancellationToken);
    Task<OrderDto> GetAsync(long id, string? include, long userId, string role, CancellationToken cancellationToken);
    Task<OrderDto> CreateAsync(CreateOrderRequest request, long userId, CancellationToken cancellationToken);
    Task<OrderDto> UpdateStatusAsync(long id, string status, long userId, string role, CancellationToken cancellationToken);
    Task DeleteAsync(long id, string role, CancellationToken cancellationToken);
}

public interface ICommentService
{
    Task<PagedResult<CommentDto>> ListAsync(CommentListQuery query, CancellationToken cancellationToken);
    Task<PagedResult<CommentDto>> ListByProductAsync(long productId, CommentListQuery query, CancellationToken cancellationToken);
    Task<CommentDto> CreateAsync(long productId, string body, long userId, CancellationToken cancellationToken);
    Task<CommentDto> UpdateAsync(long id, string body, long userId, string role, CancellationToken cancellationToken);
    Task DeleteAsync(long id, long userId, string role, CancellationToken cancellationToken);
}

public interface IDemoSeeder
{
    Task<SeedSummary> SeedAsync(CancellationToken cancellationToken = default);
}
