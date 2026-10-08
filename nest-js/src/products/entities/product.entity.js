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
const { primaryGeneratedType, decimalTransformer } = require('../../common/utils/column-type');

@Entity('products')
class Product {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId;

  @ApiProperty({ type: String, example: 'Wireless Keyboard', maxLength: 150 })
  @Column({ type: 'varchar', length: 150 })
  name;

  @ApiProperty({ type: String, example: 'wireless-keyboard', maxLength: 180 })
  @Column({ type: 'varchar', length: 180, unique: true })
  slug;

  @ApiProperty({ type: String, example: 'Low profile mechanical keyboard', nullable: true })
  @Column({ type: 'text', nullable: true })
  description;

  @ApiProperty({ type: Number, example: 149.99 })
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  price;

  @ApiProperty({ type: Number, example: 25 })
  @Column({ type: 'int', default: 0 })
  stock;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @ManyToOne(() => require('../../categories/entities/category.entity').Category, (category) => category.products, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'category_id' })
  category;

  @OneToMany(() => require('../../comments/entities/comment.entity').Comment, (comment) => comment.product)
  comments;
}

module.exports = { Product };