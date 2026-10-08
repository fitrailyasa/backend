const { ApiProperty } = require('@nestjs/swagger');
const { Exclude } = require('class-transformer');
const { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } = require('typeorm');
const { primaryGeneratedType, enumColumnType } = require('../../common/utils/column-type');

const USER_ROLES = ['user', 'admin'];

@Entity('users')
class User {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: String, example: 'John Doe', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name;

  @ApiProperty({ type: String, example: 'john@example.com', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, unique: true })
  email;

  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  password;

  @ApiProperty({ enum: USER_ROLES, example: 'user' })
  @Column({ type: enumColumnType(), enum: USER_ROLES, default: 'user' })
  role;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;

  @OneToMany(() => require('../../orders/entities/order.entity').Order, (order) => order.user)
  orders;

  @OneToMany(() => require('../../comments/entities/comment.entity').Comment, (comment) => comment.user)
  comments;
}

module.exports = { User, USER_ROLES };