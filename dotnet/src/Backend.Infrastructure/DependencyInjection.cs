using Backend.Application.Abstractions;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Security;
using Backend.Infrastructure.Seeding;
using Backend.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddMemoryCache();
        services.Configure<JwtOptions>(options => configuration.GetSection(JwtOptions.SectionName).Bind(options));
        services.Configure<LoginRateLimitOptions>(options => configuration.GetSection(LoginRateLimitOptions.SectionName).Bind(options));
        var providerName = configuration["Database:Provider"] ?? "MySql";
        if (providerName.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton(_ =>
            {
                var connectionString = configuration.GetConnectionString("Default") ?? "DataSource=:memory:";
                var connection = new SqliteConnection(connectionString);
                connection.Open();
                using var command = connection.CreateCommand();
                command.CommandText = "PRAGMA foreign_keys = ON;";
                command.ExecuteNonQuery();
                return connection;
            });
        }

        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            var sqlite = provider.GetService<SqliteConnection>();
            if (sqlite is not null)
            {
                options.UseSqlite(sqlite);
                return;
            }

            var connectionString = configuration.GetConnectionString("Default")
                ?? "Server=127.0.0.1;Port=3306;Database=backend_starter;User=root;Password=;";
            options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36)), mysql =>
                mysql.MigrationsAssembly(typeof(AppDbContext).Assembly.GetName().Name));
        });

        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddSingleton<ITokenBlacklist, MemoryTokenBlacklist>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<ILoginAttemptService>(provider => new LoginAttemptService(provider.GetRequiredService<IOptions<LoginRateLimitOptions>>().Value));
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ITagService, TagService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IDemoSeeder, DemoSeeder>();
        return services;
    }
}
