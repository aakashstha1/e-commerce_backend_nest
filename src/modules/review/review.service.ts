import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schema/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  Order,
  OrderDocument,
  OrderStatus,
} from '../order/schema/order.schema';
import {
  OrderItem,
  OrderItemDocument,
} from '../order/schema/order-item.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name)
    private orderItemModel: Model<OrderItemDocument>,
  ) {}

  /** Enforces "verified purchase" reviews: the user must have a delivered order containing this product. */
  private async assertVerifiedPurchase(userId: string, productId: string) {
    const deliveredOrders = await this.orderModel
      .find({ userId, status: OrderStatus.DELIVERED })
      .select('_id')
      .exec();

    if (deliveredOrders.length === 0) {
      throw new ForbiddenException(
        'You can only review products from orders that have been delivered to you',
      );
    }

    const purchased = await this.orderItemModel
      .exists({
        orderId: { $in: deliveredOrders.map((o) => o._id) },
        productId,
      })
      .exec();

    if (!purchased) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }
  }

  async create(userId: string, dto: CreateReviewDto) {
    await this.assertVerifiedPurchase(userId, dto.productId);

    const existing = await this.reviewModel.findOne({
      userId,
      productId: dto.productId,
    });
    if (existing) {
      throw new BadRequestException(
        'You have already reviewed this product. Update your existing review instead.',
      );
    }

    return this.reviewModel.create({ ...dto, userId });
  }

  findAllForProduct(productId: string) {
    return this.reviewModel
      .find({ productId })
      .populate('userId', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Aggregate rating summary for a product's page (average + distribution). */
  async getProductRatingSummary(productId: string) {
    const stats = await this.reviewModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let totalCount = 0;
    let ratingSum = 0;
    for (const s of stats) {
      distribution[s._id] = s.count;
      totalCount += s.count;
      ratingSum += s._id * s.count;
    }

    return {
      average: totalCount ? Math.round((ratingSum / totalCount) * 10) / 10 : 0,
      totalCount,
      distribution,
    };
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId.toString() !== userId) {
      throw new ForbiddenException('This review does not belong to you');
    }

    Object.assign(review, dto);
    return review.save();
  }

  async remove(userId: string, reviewId: string, isAdmin: boolean) {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) throw new NotFoundException('Review not found');
    if (!isAdmin && review.userId.toString() !== userId) {
      throw new ForbiddenException('This review does not belong to you');
    }

    await review.deleteOne();
    return { message: 'Review deleted successfully' };
  }
}
