import { Expose } from 'class-transformer';
import { decimalTransformer, primaryGeneratedType } from '../../common/utils/column-type';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Minimal shape of a `categories` row, used to avoid cross module imports. */
export type CategoryRef = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

/** Shape of a `tags` row, populated through `?include=tags`. */
export type TagRef = {
  id: number;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
};

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Expose({ name: 'category_id' })
  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId!: number;

  @ManyToOne('Category', { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: CategoryRef;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  price!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  /** Populated by ProductsService when `?include=tags` is requested. */
  tags?: TagRef[];

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}