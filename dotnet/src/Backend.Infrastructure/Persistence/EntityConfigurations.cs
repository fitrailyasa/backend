using Backend.Domain.Entities;
using Backend.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Backend.Infrastructure.Persistence;

internal static class Audit
{
    public static void Configure<T>(EntityTypeBuilder<T> builder) where T : AuditableEntity
    {
        builder.HasKey(entity => entity.Id);
        builder.Property(entity => entity.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(entity => entity.CreatedAt).HasColumnName("created_at").HasColumnType("datetime").IsRequired();
        builder.Property(entity => entity.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime").IsRequired();
    }
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        Audit.Configure(builder);
        builder.Property(user => user.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(user => user.Email).HasColumnName("email").HasMaxLength(150).IsRequired();
        builder.Property(user => user.Password).HasColumnName("password").HasMaxLength(255).IsRequired();
        builder.Property(user => user.Role)
            .HasColumnName("role")
            .HasMaxLength(20)
            .IsRequired()
            .HasConversion(
                role => role == UserRole.Admin ? "admin" : "user",
                value => value == "admin" ? UserRole.Admin : UserRole.User);
        builder.HasIndex(user => user.Email).IsUnique().HasDatabaseName("users_email_unique");
    }
}

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");
        Audit.Configure(builder);
        builder.Property(category => category.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(category => category.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        builder.Property(category => category.Description).HasColumnName("description").HasColumnType("text");
        builder.HasIndex(category => category.Slug).IsUnique().HasDatabaseName("categories_slug_unique");
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");
        Audit.Configure(builder);
        builder.Property(product => product.CategoryId).HasColumnName("category_id").IsRequired();
        builder.Property(product => product.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(product => product.Slug).HasColumnName("slug").HasMaxLength(180).IsRequired();
        builder.Property(product => product.Description).HasColumnName("description").HasColumnType("text");
        builder.Property(product => product.Price).HasColumnName("price").HasColumnType("decimal(12,2)").HasPrecision(12, 2).IsRequired();
        builder.Property(product => product.Stock).HasColumnName("stock").HasDefaultValue(0).IsRequired();
        builder.HasIndex(product => product.Slug).IsUnique().HasDatabaseName("products_slug_unique");
        builder.HasIndex(product => product.CategoryId).HasDatabaseName("products_category_id_idx");
        builder.HasOne(product => product.Category)
            .WithMany(category => category.Products)
            .HasForeignKey(product => product.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(product => product.Tags)
            .WithMany(tag => tag.Products)
            .UsingEntity<ProductTag>(
                right => right.HasOne(link => link.Tag).WithMany(tag => tag.ProductTags).HasForeignKey(link => link.TagId).OnDelete(DeleteBehavior.Cascade),
                left => left.HasOne(link => link.Product).WithMany(product => product.ProductTags).HasForeignKey(link => link.ProductId).OnDelete(DeleteBehavior.Cascade),
                join =>
                {
                    join.ToTable("product_tag");
                    join.HasKey(link => link.Id);
                    join.Property(link => link.Id).HasColumnName("id").ValueGeneratedOnAdd();
                    join.Property(link => link.ProductId).HasColumnName("product_id");
                    join.Property(link => link.TagId).HasColumnName("tag_id");
                    join.HasIndex(link => new { link.ProductId, link.TagId }).IsUnique().HasDatabaseName("product_tag_product_id_tag_id_unique");
                });
    }
}

internal sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.ToTable("tags");
        Audit.Configure(builder);
        builder.Property(tag => tag.Name).HasColumnName("name").HasMaxLength(60).IsRequired();
        builder.Property(tag => tag.Slug).HasColumnName("slug").HasMaxLength(80).IsRequired();
        builder.HasIndex(tag => tag.Slug).IsUnique().HasDatabaseName("tags_slug_unique");
    }
}

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");
        Audit.Configure(builder);
        builder.Property(order => order.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(order => order.Total).HasColumnName("total").HasColumnType("decimal(12,2)").HasPrecision(12, 2).IsRequired();
        builder.Property(order => order.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired()
            .HasConversion(
                status => status == OrderStatus.Paid ? "paid" : status == OrderStatus.Shipped ? "shipped" : status == OrderStatus.Completed ? "completed" : status == OrderStatus.Cancelled ? "cancelled" : "pending",
                value => value == "paid" ? OrderStatus.Paid : value == "shipped" ? OrderStatus.Shipped : value == "completed" ? OrderStatus.Completed : value == "cancelled" ? OrderStatus.Cancelled : OrderStatus.Pending);
        builder.HasIndex(order => order.UserId).HasDatabaseName("orders_user_id_idx");
        builder.HasOne(order => order.User)
            .WithMany(user => user.Orders)
            .HasForeignKey(order => order.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("order_items");
        Audit.Configure(builder);
        builder.Property(item => item.OrderId).HasColumnName("order_id").IsRequired();
        builder.Property(item => item.ProductId).HasColumnName("product_id").IsRequired();
        builder.Property(item => item.Quantity).HasColumnName("quantity").IsRequired();
        builder.Property(item => item.Price).HasColumnName("price").HasColumnType("decimal(12,2)").HasPrecision(12, 2).IsRequired();
        builder.HasIndex(item => item.OrderId).HasDatabaseName("order_items_order_id_idx");
        builder.HasIndex(item => item.ProductId).HasDatabaseName("order_items_product_id_idx");
        builder.HasOne(item => item.Order)
            .WithMany(order => order.Items)
            .HasForeignKey(item => item.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.Product)
            .WithMany(product => product.OrderItems)
            .HasForeignKey(item => item.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");
        Audit.Configure(builder);
        builder.Property(comment => comment.ProductId).HasColumnName("product_id").IsRequired();
        builder.Property(comment => comment.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(comment => comment.Body).HasColumnName("body").HasColumnType("text").IsRequired();
        builder.HasIndex(comment => comment.ProductId).HasDatabaseName("comments_product_id_idx");
        builder.HasIndex(comment => comment.UserId).HasDatabaseName("comments_user_id_idx");
        builder.HasOne(comment => comment.Product)
            .WithMany(product => product.Comments)
            .HasForeignKey(comment => comment.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(comment => comment.User)
            .WithMany(user => user.Comments)
            .HasForeignKey(comment => comment.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
