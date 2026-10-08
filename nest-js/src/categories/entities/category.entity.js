const { ApiProperty } = require('@nestjs/swagger');
const { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } = require('typeorm');
const { primaryGeneratedType } = require('../../common/utils/column-type');

@Entity('categories')
class Category {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: String, example: 'Electronics', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name;

  @ApiProperty({ type: String, example: 'electronics', maxLength: 120 })
  @Column({ type: 'varchar', length: 120, unique: true })
  slug;

  @ApiProperty({ type: String, example: 'Phones, laptops and accessories', nullable: true })
  @Column({ type: 'text', nullable: true })
  description;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @OneToMany(() => require('../../products/entities/product.entity').Product, (product) => product.category)
  products;
}

module.exports = { Category };