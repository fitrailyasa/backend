const { ApiProperty } = require('@nestjs/swagger');
const {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} = require('typeorm');
const { primaryGeneratedType, decimalTransformer, enumColumnType } = require('../../common/utils/column-type');

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];

@Entity('orders')
class Order {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId;

  @ApiProperty({ enum: ORDER_STATUSES, example: 'pending' })
  @Column({ type: enumColumnType(), enum: ORDER_STATUSES, default: 'pending' })
  status;

  @ApiProperty({ type: Number, example: 299.98, description: 'computed server side from the order items' })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  total;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @ManyToOne(() => require('../../users/entities/user.entity').User, (user) => user.orders, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user;

  @OneToMany(() => require('./order-item.entity').OrderItem, (item) => item.order, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  items;
}

module.exports = { Order, ORDER_STATUSES };