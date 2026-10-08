import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';

const Comment = sequelize.define(
  'Comment',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    product_id: { type: idType, allowNull: false },
    user_id: { type: idType, allowNull: false },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: { msg: 'Body is required' } },
    },
  },
  {
    tableName: 'comments',
    underscored: true,
  },
);

export default Comment;
