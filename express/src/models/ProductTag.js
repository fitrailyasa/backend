import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';

const ProductTag = sequelize.define(
  'ProductTag',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    product_id: { type: idType, allowNull: false },
    tag_id: { type: idType, allowNull: false },
  },
  {
    tableName: 'product_tag',
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, name: 'product_tag_product_id_tag_id_unique', fields: ['product_id', 'tag_id'] }],
  },
);

export default ProductTag;
