import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';

export const ORDER_STATUSES = Object.freeze(['pending', 'paid', 'shipped', 'completed', 'cancelled']);

const Order = sequelize.define(
  'Order',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    user_id: { type: idType, allowNull: false },
    status: {
      type: DataTypes.ENUM(...ORDER_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: { args: [ORDER_STATUSES], msg: `Status must be one of: ${ORDER_STATUSES.join(', ')}` } },
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Total must be greater than or equal to 0' } },
    },
  },
  {
    tableName: 'orders',
    underscored: true,
  },
);

function asMoney(value) {
  return value === null || value === undefined ? value : Number(value);
}

Order.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  values.total = asMoney(values.total);
  if (Array.isArray(values.items)) {
    values.items = values.items.map((item) => ({
      ...item,
      price: asMoney(item.price),
      quantity: item.quantity === null || item.quantity === undefined ? item.quantity : Number(item.quantity),
      ...(item.product ? { product: { ...item.product, price: asMoney(item.product.price) } } : {}),
    }));
  }
  return values;
};

export default Order;
