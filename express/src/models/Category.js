import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';
import { slugify } from '../utils/slugify.js';

const Category = sequelize.define(
  'Category',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } },
    },
    slug: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: { name: 'categories_slug_unique', msg: 'The slug has already been taken.' },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'categories',
    underscored: true,
    indexes: [{ unique: true, name: 'categories_slug_unique', fields: ['slug'] }],
  },
);

Category.addHook('beforeValidate', (category) => {
  if (!category.slug && category.name) {
    category.slug = slugify(category.name);
  }
});

export default Category;
