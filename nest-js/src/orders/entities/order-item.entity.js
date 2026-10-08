const { ApiProperty } = require('@nestjs/swagger');
const {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} = require('typeorm');
const { primaryGeneratedType, decimalTransformer } = require('../../common/utils/column-type');

@Entity('order_items')
class OrderItem {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId;

  @ApiProperty({ type: Number, example: 2 })
  @Column({ type: 'int' })
  quantity;

  @ApiProperty({ type: Number, example: 149.99, description: 'price snapshot taken when the order was created' })
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  price;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @ManyToOne(() => require('./order.entity').Order, (order) => order.items, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'order_id' })
  order;

  @ManyToOne(() => require('../../products/entities/product.entity').Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product;
}

module.exports = { OrderItem };