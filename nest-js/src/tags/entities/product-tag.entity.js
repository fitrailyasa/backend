const { ApiProperty } = require('@nestjs/swagger');
const { Column, Entity, Index, PrimaryGeneratedColumn } = require('typeorm');
const { primaryGeneratedType } = require('../../common/utils/column-type');

@Entity('product_tag')
@Index('uq_product_tag', ['productId', 'tagId'], { unique: true })
class ProductTag {
  @ApiProperty({ type: Number, example: 1 })
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId;

  @ApiProperty({ type: Number, example: 1 })
  @Column({ name: 'tag_id', type: 'bigint', unsigned: true })
  tagId;
}

module.exports = { ProductTag };