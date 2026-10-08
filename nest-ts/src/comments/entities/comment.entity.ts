import { Expose } from 'class-transformer';
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
import { primaryGeneratedType } from '../../common/utils/column-type';

type ProductRef = { id: number; categoryId: number; name: string; slug: string };
type UserRef = { id: number; name: string; email: string; role: string };

@Entity('comments')
@Index('idx_comments_product_id', ['productId'])
@Index('idx_comments_user_id', ['userId'])
export class Comment {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Expose({ name: 'product_id' })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: number;

  @ManyToOne('Product', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductRef;

  @Expose({ name: 'user_id' })
  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: number;

  @ManyToOne('User', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserRef;

  @Column({ type: 'text' })
  body!: string;

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}