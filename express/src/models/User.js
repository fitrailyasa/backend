import { DataTypes } from 'sequelize';
import sequelize, { idType } from '../config/database.js';
import { hashPassword } from '../utils/password.js';

export const ROLES = Object.freeze(['user', 'admin']);

const User = sequelize.define(
  'User',
  {
    id: { type: idType, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: { name: 'users_email_unique', msg: 'The email has already been taken.' },
      validate: { isEmail: { msg: 'The email must be a valid email address.' } },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    role: {
      type: DataTypes.ENUM(...ROLES),
      allowNull: false,
      defaultValue: 'user',
      validate: { isIn: { args: [ROLES], msg: `Role must be one of: ${ROLES.join(', ')}` } },
    },
  },
  {
    tableName: 'users',
    underscored: true,
    indexes: [{ unique: true, name: 'users_email_unique', fields: ['email'] }],
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: { attributes: { include: ['password'] } } },
  },
);

User.prototype.toJSON = function toJSON() {
  const values = this.get({ plain: true });
  return {
    id: values.id,
    name: values.name,
    email: values.email,
    role: values.role,
    created_at: values.created_at,
    updated_at: values.updated_at,
  };
};

User.addHook('beforeSave', async (user) => {
  if (user.changed('password') && typeof user.password === 'string' && user.password.length > 0) {
    user.password = await hashPassword(user.password);
  }
});

export default User;
