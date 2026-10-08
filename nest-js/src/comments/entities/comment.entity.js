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
const { primaryGeneratedType } = require('../../common/utils/column-type');

@Entity('comments')
class Comment {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId;

  @ApiProperty({ type: String, example: 'Great keyboard, highly recommended.' })
  @Column({ type: 'text' })
  body;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @ManyToOne(() => require('../../products/entities/product.entity').Product, (product) => product.comments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'product_id' })
  product;

  @ManyToOne(() => require('../../users/entities/user.entity').User, (user) => user.comments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user;
}

module.exports = { Comment };