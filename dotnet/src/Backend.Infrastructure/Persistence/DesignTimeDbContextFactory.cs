using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Backend.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        options.UseMySql(
            "Server=127.0.0.1;Port=3306;Database=backend_starter;User=root;Password=;",
            new MySqlServerVersion(new Version(8, 0, 36)),
            mysql => mysql.MigrationsAssembly(typeof(AppDbContext).Assembly.GetName().Name));
        return new AppDbContext(options.Options);
    }
}
