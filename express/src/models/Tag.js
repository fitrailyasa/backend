import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';
import { slugify } from '../utils/slugify.js';

const Tag = sequelize.define(
  'Tag',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } },
    },
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: { name: 'tags_slug_unique', msg: 'The slug has already been taken.' },
    },
  },
  {
    tableName: 'tags',
    underscored: true,
    indexes: [{ unique: true, name: 'tags_slug_unique', fields: ['slug'] }],
  },
);

Tag.addHook('beforeValidate', (tag) => {
  if (!tag.slug && tag.name) {
    tag.slug = slugify(tag.name);
  }
});

export default Tag;
