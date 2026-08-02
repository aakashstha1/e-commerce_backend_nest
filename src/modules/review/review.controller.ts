import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Public } from 'src/common/decorators/public.decorator';
import { UserRole } from '../users/enums/user-role-enum';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(userId, dto);
  }

  @Public()
  @Get('product/:productId')
  findAllForProduct(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.reviewService.findAllForProduct(productId);
  }

  @Public()
  @Get('product/:productId/summary')
  getSummary(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.reviewService.getProductRatingSummary(productId);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.reviewService.remove(userId, id, role === UserRole.ADMIN);
  }
}
