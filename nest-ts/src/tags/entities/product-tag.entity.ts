import { Exclude, Expose } from 'class-transformer';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { primaryGeneratedType } from '../../common/utils/column-type';

type ProductRef = { id: number; categoryId: number; name: string; slug: string };
type TagRef = { id: number; name: string; slug: string };

@Entity('product_tag')
@Index('uq_product_tag', ['productId', 'tagId'], { unique: true })
export class ProductTag {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Exclude()
  @Expose({ name: 'product_id' })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: number;

  @Exclude()
  @ManyToOne('Product', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductRef;

  @Expose({ name: 'tag_id' })
  @Column({ name: 'tag_id', type: 'bigint', unsigned: true })
  tagId!: number;

  @ManyToOne('Tag', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: TagRef;
}