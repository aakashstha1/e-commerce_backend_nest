import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from './schema/order.schema';
import { OrderItem, OrderItemDocument } from './schema/order-item.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { CartService } from '../cart/cart.service';
import { AddressService } from '../address/address.service';
import { ProductService } from '../product/product.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';

const SHIPPING_FEE = 100; // flat rate; swap for a real shipping-rate calculator in production
const TAX_RATE = 0.13; // e.g. Nepal VAT; make configurable per region in production

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name)
    private orderItemModel: Model<OrderItemDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly cartService: CartService,
    private readonly addressService: AddressService,
    private readonly productService: ProductService,
    private readonly notificationService: NotificationService,
  ) {}

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = randomBytes(3).toString('hex').toUpperCase();
    return `ORD-${datePart}-${randPart}`;
  }

  /**
   * Checkout workflow:
   * 1. Validate address ownership.
   * 2. Read current cart items (must be non-empty).
   * 3. Re-validate stock & pricing at the moment of purchase (source of truth, not the cart snapshot).
   * 4. Atomically decrement stock for every item, create Order + OrderItems, clear the cart.
   *    Wrapped in a Mongo session/transaction so a failure midway rolls everything back.
   */
  async checkout(userId: string, dto: CreateOrderDto) {
    await this.addressService.assertOwnership(userId, dto.addressId);

    const cart = await this.cartService.getOrCreateCart(userId);
    const cartItems = await this.cartService.getCartItemsForCheckout(
      cart._id.toString(),
    );

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const session = await this.connection.startSession();
    let createdOrderId: string | undefined;

    try {
      let subTotal = 0;
      const orderItemsData: Partial<OrderItem>[] = [];

      await session.withTransaction(async () => {
        for (const item of cartItems) {
          const product = await this.productService.findOne(
            item.productId.toString(),
          );
          const unitPrice = product.discountPrice ?? product.price;

          await this.productService.decrementStock(
            item.productId.toString(),
            item.quantity,
            session,
          );

          const totalPrice = unitPrice * item.quantity;
          subTotal += totalPrice;

          orderItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
            discount: 0,
            totalPrice,
          });
        }

        // TODO: apply dto.couponCode against a Coupon collection once that module is built.
        const discount = 0;
        const shippingFee = SHIPPING_FEE;
        const tax = Math.round((subTotal - discount) * TAX_RATE * 100) / 100;
        const total = subTotal - discount + shippingFee + tax;

        const [order] = await this.orderModel.create(
          [
            {
              userId,
              addressId: dto.addressId,
              orderNumber: this.generateOrderNumber(),
              subTotal,
              discount,
              shippingFee,
              tax,
              total,
              status: OrderStatus.PENDING,
              paymentStatus: PaymentStatus.PENDING,
              placedAt: new Date(),
            },
          ],
          { session },
        );

        await this.orderItemModel.insertMany(
          orderItemsData.map((oi) => ({ ...oi, orderId: order._id })),
          { session },
        );

        await this.orderItemModel.db
          .collection('cartitems')
          .deleteMany({ cartId: cart._id }, { session });

        createdOrderId = order._id.toString();
      });

      if (createdOrderId) {
        const createdOrder = await this.orderModel
          .findById(createdOrderId)
          .exec();
        if (createdOrder) {
          await this.notificationService.create(
            userId,
            NotificationType.ORDER_PLACED,
            `Your order ${createdOrder.orderNumber} has been placed successfully.`,
          );
        }
      }

      return this.getOrderById(userId, createdOrderId!, false);
    } finally {
      await session.endSession();
    }
  }

  async getOrdersForUser(userId: string, query: QueryOrderDto) {
    const { page = 1, limit = 20, status } = query;
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllOrders(query: QueryOrderDto) {
    const { page = 1, limit = 20, status } = query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('userId', 'name email')
        .sort({ placedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderById(userId: string, orderId: string, enforceOwnership = true) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('addressId')
      .exec();
    if (!order) throw new NotFoundException('Order not found');

    if (enforceOwnership && order.userId.toString() !== userId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    const items = await this.orderItemModel
      .find({ orderId })
      .populate('productId', 'name slug thumbnailUrl')
      .exec();

    return { order, items };
  }

  /** Admin-only: transitions order status, e.g. pending -> processing -> shipped -> delivered. */
  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Order not found');

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${status}`,
      );
    }

    if (status === OrderStatus.CANCELLED) {
      const items = await this.orderItemModel.find({ orderId }).exec();
      for (const item of items) {
        await this.productService.incrementStock(
          item.productId.toString(),
          item.quantity,
        );
      }
    }

    order.status = status;
    await order.save();

    await this.notificationService.create(
      order.userId.toString(),
      NotificationType.ORDER_STATUS_UPDATED,
      `Your order ${order.orderNumber} is now ${status}.`,
    );

    return order;
  }

  /** User-initiated cancellation, only allowed before the order ships. */
  async cancelOrder(userId: string, orderId: string) {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.status)) {
      throw new BadRequestException('This order can no longer be cancelled');
    }

    return this.updateStatus(orderId, OrderStatus.CANCELLED);
  }

  /** Used internally by PaymentService once a payment is confirmed. */
  async markPaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    const order = await this.orderModel
      .findByIdAndUpdate(orderId, { paymentStatus }, { new: true })
      .exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
