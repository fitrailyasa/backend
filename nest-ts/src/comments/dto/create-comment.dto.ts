import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great product, shipping was fast.' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}
