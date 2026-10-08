import { Expose } from 'class-transformer';
import { decimalTransformer, primaryGeneratedType } from '../../common/utils/column-type';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

type ProductRef = {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
};

@Entity('order_items')
@Index('idx_order_items_order_id', ['orderId'])
@Index('idx_order_items_product_id', ['productId'])
export class OrderItem {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Expose({ name: 'order_id' })
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: number;

  @ManyToOne(() => Order, (order: Order) => order.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Expose({ name: 'product_id' })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: number;

  @ManyToOne('Product', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductRef;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    comment: 'price snapshot at order time',
    transformer: decimalTransformer,
  })
  price!: number;

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}