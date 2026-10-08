using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Domain.Enums;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Seeding;

public sealed class DemoSeeder : IDemoSeeder
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _passwords;
    private readonly IOrderService _orders;

    public DemoSeeder(AppDbContext db, IPasswordHasher passwords, IOrderService orders)
    {
        _db = db;
        _passwords = passwords;
        _orders = orders;
    }

    public async Task<SeedSummary> SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await _db.Users.AnyAsync(user => user.Email.ToLower() == "admin@example.com", cancellationToken))
        {
            return new SeedSummary(0, 0, 0, 0, 0, 0, true);
        }

        var hash = _passwords.Hash("password");
        var users = new List<User>
        {
            NewUser("Site Administrator", "admin@example.com", UserRole.Admin, hash),
            NewUser("User", "user@example.com", UserRole.User, hash),
            NewUser("User 2", "user2@example.com", UserRole.User, hash),
            NewUser("User 3", "user3@example.com", UserRole.User, hash),
            NewUser("User 4", "user4@example.com", UserRole.User, hash),
            NewUser("User 5", "user5@example.com", UserRole.User, hash)
        };
        _db.Users.AddRange(users);
        await _db.SaveChangesAsync(cancellationToken);

        var categoryRows = new (string Name, string Description)[]
        {
            ("Electronics", "Phones, laptops, audio and every day gadgets."),
            ("Books", "Fiction, non fiction and academic books."),
            ("Home & Living", "Kitchenware, decoration and furniture.")
        };
        var categories = categoryRows.Select(row => new Category
        {
            Name = row.Name,
            Slug = Slugify.From(row.Name, 120),
            Description = row.Description
        }).ToList();
        _db.Categories.AddRange(categories);
        await _db.SaveChangesAsync(cancellationToken);
        var categoryByName = categories.ToDictionary(category => category.Name);

        var tagNames = new[] { "Featured", "New Arrival", "Best Seller", "Discount", "Premium", "Eco Friendly" };
        var tags = tagNames.Select(name => new Tag { Name = name, Slug = Slugify.From(name, 80) }).ToList();
        _db.Tags.AddRange(tags);
        await _db.SaveChangesAsync(cancellationToken);

        var productRows = new (string Category, string Name, decimal Price, int Stock, string Description)[]
        {
            ("Electronics", "Smartphone X Pro", 8990000, 40, "6.7 inch AMOLED display with a triple camera."),
            ("Electronics", "Wireless Earbuds Z", 749000, 120, "Active noise cancelling earbuds with 30 hours of playback."),
            ("Electronics", "Ultra Slim Laptop 14", 15999000, 25, "14 inch ultrabook with 16GB RAM and 512GB SSD."),
            ("Electronics", "Smart Watch S2", 1299000, 80, "GPS tracking, heart rate and sleep monitoring."),
            ("Electronics", "Mechanical Keyboard K1", 899000, 60, "Hot swappable switches with a aluminium frame."),
            ("Books", "The Pragmatic Programmer", 289000, 200, "A classic guide to software craftsmanship."),
            ("Books", "Clean Architecture", 315000, 150, "A craftsman guide to software structure and design."),
            ("Books", "Daring Greatly", 199000, 180, "How to build a remarkable life at work."),
            ("Home & Living", "Cast Iron Skillet 26cm", 349000, 90, "Pre seasoned skillet, oven safe up to 260C."),
            ("Home & Living", "Linen Table Runner", 129000, 140, "Hand washed linen runner for a 180cm table.")
        };

        var products = new List<Product>();
        foreach (var row in productRows)
        {
            var product = new Product
            {
                CategoryId = categoryByName[row.Category].Id,
                Name = row.Name,
                Slug = Slugify.From(row.Name, 180),
                Description = row.Description,
                Price = row.Price,
                Stock = row.Stock
            };
            var assigned = tags.Where((_, index) => (index + products.Count) % 3 == 0).ToList();
            foreach (var tag in assigned)
            {
                product.Tags.Add(tag);
            }

            products.Add(product);
        }

        _db.Products.AddRange(products);
        await _db.SaveChangesAsync(cancellationToken);

        var orderRows = new (int User, string Status, (int Product, int Quantity)[] Items)[]
        {
            (0, "completed", [(0, 1), (4, 2)]),
            (1, "shipped", [(2, 1)]),
            (2, "paid", [(1, 3)]),
            (3, "pending", [(5, 2), (7, 1)]),
            (4, "completed", [(8, 1)]),
            (0, "cancelled", [(3, 1)]),
            (1, "paid", [(6, 4)]),
            (2, "pending", [(9, 2)]),
            (3, "shipped", [(0, 2), (1, 1)]),
            (4, "completed", [(5, 1), (8, 2)])
        };

        var orders = new List<OrderDto>();
        foreach (var row in orderRows)
        {
            var created = await _orders.CreateAsync(new CreateOrderRequest
            {
                Items = row.Items.Select(item => new OrderItemRequest
                {
                    ProductId = products[item.Product].Id,
                    Quantity = item.Quantity
                }).ToList()
            }, users[row.User].Id, cancellationToken);

            if (row.Status != "pending")
            {
                var entity = await _db.Orders.FirstAsync(order => order.Id == created.Id, cancellationToken);
                entity.Status = Mappers.ParseStatus(row.Status);
                await _db.SaveChangesAsync(cancellationToken);
            }

            orders.Add(created);
        }

        var commentRows = new (int Product, int User, string Body)[]
        {
            (0, 1, "Battery life is honestly better than advertised."),
            (0, 2, "Great phone, only wish the charger was included."),
            (0, 3, "Camera performs well even at night."),
            (1, 0, "Comfortable for long listening sessions."),
            (1, 4, "The case is a little bulky but the sound is excellent."),
            (2, 2, "Replaced my old laptop and the difference is night and day."),
            (2, 3, "Keyboard travel is comfortable for long coding sessions."),
            (3, 1, "Battery lasts about three days with notifications on."),
            (4, 0, "The tactile feel of these switches is superb."),
            (4, 2, "Loud enough for an office, not for late night work."),
            (5, 3, "Still relevant in 2026, highly recommended."),
            (6, 4, "Changed how I structure my projects."),
            (7, 1, "A gentle book that rewards a slow reader."),
            (8, 2, "Pre seasoning works perfectly out of the box."),
            (9, 0, "Colour matches the photos and it washes well.")
        };

        foreach (var row in commentRows)
        {
            _db.Comments.Add(new Comment
            {
                ProductId = products[row.Product].Id,
                UserId = users[row.User].Id,
                Body = row.Body
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        return new SeedSummary(users.Count, categories.Count, products.Count, tags.Count, orders.Count, commentRows.Length, false);
    }

    private static User NewUser(string name, string email, UserRole role, string hash) => new()
    {
        Name = name,
        Email = email,
        Password = hash,
        Role = role
    };
}
