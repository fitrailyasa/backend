import User from './User.js';
import Category from './Category.js';
import Product from './Product.js';
import Tag from './Tag.js';
import ProductTag from './ProductTag.js';
import Order from './Order.js';
import OrderItem from './OrderItem.js';
import Comment from './Comment.js';

User.hasMany(Order, { foreignKey: 'user_id', as: 'orders', onDelete: 'CASCADE' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products', onDelete: 'RESTRICT' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.hasMany(Comment, { foreignKey: 'product_id', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems', onDelete: 'RESTRICT' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Product.belongsToMany(Tag, {
  through: ProductTag,
  as: 'tags',
  foreignKey: 'product_id',
  otherKey: 'tag_id',
});
Tag.belongsToMany(Product, {
  through: ProductTag,
  as: 'products',
  foreignKey: 'tag_id',
  otherKey: 'product_id',
});

export {
  User,
  Category,
  Product,
  Tag,
  ProductTag,
  Order,
  OrderItem,
  Comment,
};

export default {
  User,
  Category,
  Product,
  Tag,
  ProductTag,
  Order,
  OrderItem,
  Comment,
};
