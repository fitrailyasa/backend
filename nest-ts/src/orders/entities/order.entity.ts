import { Expose } from 'class-transformer';
import { decimalTransformer, enumColumnType, primaryGeneratedType } from '../../common/utils/column-type';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type UserRef = {
  id: number;
  name: string;
  email: string;
  role: string;
};

@Entity('orders')
@Index('idx_orders_user_id', ['userId'])
@Index('idx_orders_status', ['status'])
export class Order {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Expose({ name: 'user_id' })
  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: number;

  @ManyToOne('User', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserRef;

  @Column({
    type: enumColumnType(),
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  total!: number;

  @OneToMany(() => OrderItem, (item: OrderItem) => item.order, { onDelete: 'CASCADE' })
  items?: OrderItem[];

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}