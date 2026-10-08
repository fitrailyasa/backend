import { Expose } from 'class-transformer';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { primaryGeneratedType } from '../../common/utils/column-type';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn({ type: primaryGeneratedType(), unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug!: string;

  @Expose({ name: 'created_at' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Expose({ name: 'updated_at' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}