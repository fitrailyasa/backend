package com.backend.starter.seed;

import com.backend.starter.catalog.entity.Category;
import com.backend.starter.catalog.entity.Product;
import com.backend.starter.catalog.entity.ProductTag;
import com.backend.starter.catalog.entity.Tag;
import com.backend.starter.catalog.repo.CategoryRepository;
import com.backend.starter.catalog.repo.ProductRepository;
import com.backend.starter.catalog.repo.ProductTagRepository;
import com.backend.starter.catalog.repo.TagRepository;
import com.backend.starter.catalog.service.ProductService;
import com.backend.starter.comment.entity.Comment;
import com.backend.starter.comment.repo.CommentRepository;
import com.backend.starter.common.Slugify;
import com.backend.starter.config.AppProperties;
import com.backend.starter.order.dto.OrderDtos.CreateOrderRequest;
import com.backend.starter.order.dto.OrderDtos.Item;
import com.backend.starter.order.entity.CustomerOrder;
import com.backend.starter.order.entity.OrderStatus;
import com.backend.starter.order.repo.OrderRepository;
import com.backend.starter.order.service.OrderService;
import com.backend.starter.user.entity.Role;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Component
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final AppProperties properties;
    private final Environment environment;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final ProductRepository productRepository;
    private final ProductTagRepository productTagRepository;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final CommentRepository commentRepository;

    public DemoDataSeeder(
            AppProperties properties,
            Environment environment,
            PasswordEncoder passwordEncoder,
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            TagRepository tagRepository,
            ProductRepository productRepository,
            ProductTagRepository productTagRepository,
            OrderRepository orderRepository,
            OrderService orderService,
            CommentRepository commentRepository
    ) {
        this.properties = properties;
        this.environment = environment;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.tagRepository = tagRepository;
        this.productRepository = productRepository;
        this.productTagRepository = productTagRepository;
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.commentRepository = commentRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean profile = Arrays.asList(environment.getActiveProfiles()).contains("seed");
        if (!properties.isSeed() && !profile) {
            return;
        }
        if (userRepository.findByEmailIgnoreCase("admin@example.com").isPresent()) {
            log.info("Seed skipped because admin@example.com already exists");
            return;
        }

        String hash = passwordEncoder.encode("password");
        List<User> users = new ArrayList<>();
        users.add(user("Site Administrator", "admin@example.com", hash, Role.admin));
        users.add(user("User", "user@example.com", hash, Role.user));
        users.add(user("User 2", "user2@example.com", hash, Role.user));
        users.add(user("User 3", "user3@example.com", hash, Role.user));
        users.add(user("User 4", "user4@example.com", hash, Role.user));
        users.add(user("User 5", "user5@example.com", hash, Role.user));

        List<Category> categories = List.of(
                category("Electronics", "Phones, laptops, audio and every day gadgets."),
                category("Books", "Fiction, non fiction and academic books."),
                category("Home & Living", "Kitchenware, decoration and furniture.")
        );
        List<Tag> tags = List.of("Featured", "New Arrival", "Best Seller", "Discount", "Premium", "Eco Friendly")
                .stream().map(this::tag).toList();

        record SeedProduct(String category, String name, long price, int stock, String description) {
        }
        List<SeedProduct> catalog = List.of(
                new SeedProduct("Electronics", "Smartphone X Pro", 8990000, 40, "6.7 inch AMOLED display with a triple camera."),
                new SeedProduct("Electronics", "Wireless Earbuds Z", 749000, 120, "Active noise cancelling earbuds with 30 hours of playback."),
                new SeedProduct("Electronics", "Ultra Slim Laptop 14", 15999000, 25, "14 inch ultrabook with 16GB RAM and 512GB SSD."),
                new SeedProduct("Electronics", "Smart Watch S2", 1299000, 80, "GPS tracking, heart rate and sleep monitoring."),
                new SeedProduct("Electronics", "Mechanical Keyboard K1", 899000, 60, "Hot swappable switches with a aluminium frame."),
                new SeedProduct("Books", "The Pragmatic Programmer", 289000, 200, "A classic guide to software craftsmanship."),
                new SeedProduct("Books", "Clean Architecture", 315000, 150, "A craftsman guide to software structure and design."),
                new SeedProduct("Books", "Daring Greatly", 199000, 180, "How to build a remarkable life at work."),
                new SeedProduct("Home & Living", "Cast Iron Skillet 26cm", 349000, 90, "Pre seasoned skillet, oven safe up to 260C."),
                new SeedProduct("Home & Living", "Linen Table Runner", 129000, 140, "Hand washed linen runner for a 180cm table.")
        );

        List<Product> products = new ArrayList<>();
        for (SeedProduct payload : catalog) {
            Category category = categories.stream().filter(item -> item.getName().equals(payload.category())).findFirst().orElseThrow();
            Product product = new Product();
            product.setCategoryId(category.getId());
            product.setName(payload.name());
            product.setSlug(Slugify.of(payload.name(), 180));
            product.setDescription(payload.description());
            product.setPrice(ProductService.money(BigDecimal.valueOf(payload.price())));
            product.setStock(payload.stock());
            product = productRepository.save(product);
            for (int index = 0; index < tags.size(); index++) {
                if ((index + products.size()) % 3 == 0) {
                    ProductTag link = new ProductTag();
                    link.setProductId(product.getId());
                    link.setTagId(tags.get(index).getId());
                    productTagRepository.save(link);
                }
            }
            products.add(product);
        }

        record SeedOrder(int user, String status, int[][] items) {
        }
        List<SeedOrder> orders = List.of(
                new SeedOrder(0, "completed", new int[][]{{0, 1}, {4, 2}}),
                new SeedOrder(1, "shipped", new int[][]{{2, 1}}),
                new SeedOrder(2, "paid", new int[][]{{1, 3}}),
                new SeedOrder(3, "pending", new int[][]{{5, 2}, {7, 1}}),
                new SeedOrder(4, "completed", new int[][]{{8, 1}}),
                new SeedOrder(0, "cancelled", new int[][]{{3, 1}}),
                new SeedOrder(1, "paid", new int[][]{{6, 4}}),
                new SeedOrder(2, "pending", new int[][]{{9, 2}}),
                new SeedOrder(3, "shipped", new int[][]{{0, 2}, {1, 1}}),
                new SeedOrder(4, "completed", new int[][]{{5, 1}, {8, 2}})
        );
        for (SeedOrder payload : orders) {
            CreateOrderRequest request = new CreateOrderRequest();
            List<Item> items = new ArrayList<>();
            for (int[] item : payload.items()) {
                Item line = new Item();
                line.setProductId(products.get(item[0]).getId());
                line.setQuantity(item[1]);
                items.add(line);
            }
            request.setItems(items);
            var created = orderService.create(users.get(payload.user()).getId(), request);
            if (!"pending".equals(payload.status())) {
                CustomerOrder order = orderRepository.findById(created.id()).orElseThrow();
                order.setStatus(OrderStatus.valueOf(payload.status()));
                orderRepository.save(order);
            }
        }

        record SeedComment(int product, int user, String body) {
        }
        List<SeedComment> comments = List.of(
                new SeedComment(0, 1, "Battery life is honestly better than advertised."),
                new SeedComment(0, 2, "Great phone, only wish the charger was included."),
                new SeedComment(0, 3, "Camera performs well even at night."),
                new SeedComment(1, 0, "Comfortable for long listening sessions."),
                new SeedComment(1, 4, "The case is a little bulky but the sound is excellent."),
                new SeedComment(2, 2, "Replaced my old laptop and the difference is night and day."),
                new SeedComment(2, 3, "Keyboard travel is comfortable for long coding sessions."),
                new SeedComment(3, 1, "Battery lasts about three days with notifications on."),
                new SeedComment(4, 0, "The tactile feel of these switches is superb."),
                new SeedComment(4, 2, "Loud enough for an office, not for late night work."),
                new SeedComment(5, 3, "Still relevant in 2026, highly recommended."),
                new SeedComment(6, 4, "Changed how I structure my projects."),
                new SeedComment(7, 1, "A gentle book that rewards a slow reader."),
                new SeedComment(8, 2, "Pre seasoning works perfectly out of the box."),
                new SeedComment(9, 0, "Colour matches the photos and it washes well.")
        );
        for (SeedComment payload : comments) {
            Comment comment = new Comment();
            comment.setProductId(products.get(payload.product()).getId());
            comment.setUserId(users.get(payload.user()).getId());
            comment.setBody(payload.body());
            commentRepository.save(comment);
        }

        log.info("Seeded demo data: users={}, categories={}, tags={}, products={}, orders={}, comments={}",
                users.size(), categories.size(), tags.size(), products.size(), orders.size(), comments.size());
        log.info("Seeded admin account: admin@example.com (login password documented in README.md)");
    }

    private User user(String name, String email, String password, Role role) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(password);
        user.setRole(role);
        return userRepository.save(user);
    }

    private Category category(String name, String description) {
        Category category = new Category();
        category.setName(name);
        category.setSlug(Slugify.of(name, 120));
        category.setDescription(description);
        return categoryRepository.save(category);
    }

    private Tag tag(String name) {
        Tag tag = new Tag();
        tag.setName(name);
        tag.setSlug(Slugify.of(name, 80));
        return tagRepository.save(tag);
    }
}
