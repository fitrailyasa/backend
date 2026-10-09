import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great product, shipping was fast.' })
  @Trim()
  @IsString({ message: 'Body must be a string.' })
  @IsNotEmpty({ message: 'Body is required.' })
  @MaxLength(2000, { message: 'Body must be between 1 and 2000 characters.' })
  body!: string;
}
