import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    order_id: { type: idType, allowNull: false },
    product_id: { type: idType, allowNull: false },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: { args: [1], msg: 'Quantity must be at least 1' } },
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Price must be greater than or equal to 0' } },
    },
  },
  {
    tableName: 'order_items',
    underscored: true,
  },
);

OrderItem.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  values.price = values.price === null || values.price === undefined ? values.price : Number(values.price);
  return values;
};

export default OrderItem;
