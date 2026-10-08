const { ApiProperty } = require('@nestjs/swagger');
const { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } = require('typeorm');
const { primaryGeneratedType } = require('../../common/utils/column-type');

@Entity('tags')
class Tag {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: String, example: 'Featured', maxLength: 60 })
  @Column({ type: 'varchar', length: 60 })
  name;

  @ApiProperty({ type: String, example: 'featured', maxLength: 80 })
  @Column({ type: 'varchar', length: 80, unique: true })
  slug;

  @ApiProperty({ type: Date })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt;

  @ApiProperty({ type: Date })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt;
}

module.exports = { Tag };