import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  PaymentMethod,
  PaymentTransactionStatus,
} from './schema/payment.schema';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { OrderService } from '../order/order.service';
import { PaymentStatus } from '../order/schema/order.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Starts a payment for an order.
   * - COD: recorded as pending; gets marked paid on delivery via `markCodPaid`.
   * - Gateway methods (stripe/esewa/khalti): in production this would call the
   *   gateway's "create payment intent / initiate transaction" API and return a
   *   redirect URL or client secret. Wire the real SDK call in `createGatewaySession`.
   */
  async initiate(userId: string, dto: InitiatePaymentDto) {
    const { order } = await this.orderService.getOrderById(userId, dto.orderId);

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This order has already been paid for');
    }

    const existing = await this.paymentModel
      .findOne({ orderId: dto.orderId })
      .exec();
    if (existing && existing.status === PaymentTransactionStatus.PENDING) {
      return existing; // idempotent: reuse pending payment record
    }

    const payment = await this.paymentModel.create({
      orderId: dto.orderId,
      method: dto.method,
      amount: order.total,
      currency: 'NPR',
      status: PaymentTransactionStatus.PENDING,
    });

    if (dto.method === PaymentMethod.COD) {
      return payment;
    }

    // Placeholder for real gateway integration.
    const gatewaySession = this.createGatewaySession(dto.method, payment);
    return { payment, ...gatewaySession };
  }

  /** Swap this stub for real Stripe/eSewa/Khalti SDK calls. */
  private createGatewaySession(
    method: PaymentMethod,
    payment: PaymentDocument,
  ) {
    return {
      redirectUrl: `https://payment-gateway.example.com/${method}/checkout?paymentId=${payment._id.toString()}`,
      note: `Integrate the real ${method} SDK here (create payment intent / initiate eSewa or Khalti transaction).`,
    };
  }

  /** Called by a (to-be-implemented) verified webhook handler once the gateway confirms payment. */
  async confirmPayment(dto: ConfirmPaymentDto) {
    const payment = await this.paymentModel.findById(dto.paymentId).exec();
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentTransactionStatus.PAID;
    payment.transactionId = dto.transactionId ?? payment.transactionId;
    payment.paidAt = new Date();
    await payment.save();

    const order = await this.orderService.markPaymentStatus(
      payment.orderId.toString(),
      PaymentStatus.PAID,
    );

    await this.notificationService.create(
      order.userId.toString(),
      NotificationType.PAYMENT_RECEIVED,
      `Payment received for order ${order.orderNumber}.`,
    );

    return payment;
  }

  async markFailed(paymentId: string) {
    const payment = await this.paymentModel
      .findByIdAndUpdate(
        paymentId,
        { status: PaymentTransactionStatus.FAILED },
        { new: true },
      )
      .exec();
    if (!payment) throw new NotFoundException('Payment not found');

    const order = await this.orderService.markPaymentStatus(
      payment.orderId.toString(),
      PaymentStatus.FAILED,
    );

    await this.notificationService.create(
      order.userId.toString(),
      NotificationType.PAYMENT_FAILED,
      `Payment failed for order ${order.orderNumber}. Please try again.`,
    );

    return payment;
  }

  /** Admin-only: marks a Cash-On-Delivery payment as collected, typically on delivery confirmation. */
  async markCodPaid(paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.method !== PaymentMethod.COD) {
      throw new BadRequestException(
        'Only COD payments can be marked paid manually',
      );
    }

    return this.confirmPayment({ paymentId });
  }

  async getByOrder(userId: string, orderId: string, isAdmin: boolean) {
    if (!isAdmin) {
      await this.orderService.getOrderById(userId, orderId); // enforces ownership, throws otherwise
    }
    const payment = await this.paymentModel.findOne({ orderId }).exec();
    if (!payment)
      throw new NotFoundException('Payment not found for this order');
    return payment;
  }
}
