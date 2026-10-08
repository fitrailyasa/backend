import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { primaryGeneratedType } from '../../common/utils/column-type';

/** Shape of the `products` row when it is attached through `?include=products`. */
export type ProductRef = {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
};

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany('Product', (product: { category: unknown }) => product.category, {
    onDelete: 'RESTRICT',
  })
  products!: ProductRef[];

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}