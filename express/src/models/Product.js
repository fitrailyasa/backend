import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';
import { slugify } from '../utils/slugify.js';

const Product = sequelize.define(
  'Product',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    category_id: { type: idType, allowNull: false },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } },
    },
    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: { name: 'products_slug_unique', msg: 'The slug has already been taken.' },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Price must be greater than or equal to 0' } },
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Stock must be greater than or equal to 0' } },
    },
  },
  {
    tableName: 'products',
    underscored: true,
    indexes: [
      { unique: true, name: 'products_slug_unique', fields: ['slug'] },
      { name: 'products_category_id_idx', fields: ['category_id'] },
    ],
  },
);

Product.addHook('beforeValidate', (product) => {
  if (!product.slug && product.name) {
    product.slug = slugify(product.name);
  }
});

Product.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  values.price = values.price === null || values.price === undefined ? values.price : Number(values.price);
  return values;
};

export default Product;
