/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  Payment,
  PaymentDocument,
  PaymentMethod,
  PaymentTransactionStatus,
} from './schema/payment.schema';

import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { OrderService } from '../order/order.service';
import {
  OrderPaymentMethod,
  PaymentStatus,
} from '../order/schema/order.schema';
import { AddressService } from '../address/address.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { EsewaService } from './esewa/esewa.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PendingCheckout,
  PendingCheckoutDocument,
  PendingCheckoutStatus,
} from './schema/pending-checkout.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(PendingCheckout.name)
    private pendingCheckoutModel: Model<PendingCheckoutDocument>,
    private readonly orderService: OrderService,
    private readonly addressService: AddressService,
    private readonly notificationService: NotificationService,
    private readonly esewaService: EsewaService,
  ) {}

  /**
   * COD only. Records a pending, cash-collected-on-delivery payment against an
   * already-created order. Admin marks it paid manually once delivered (see
   * `markCodPaid`) — that's the whole point of COD's payment tracking.
   */
  async initiate(userId: string, dto: InitiatePaymentDto) {
    if (dto.method !== PaymentMethod.COD) {
      throw new BadRequestException(
        'Only Cash on Delivery can be initiated this way. Use /payments/esewa/initiate for online payment.',
      );
    }

    const { order } = await this.orderService.getOrderById(userId, dto.orderId);

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This order has already been paid for');
    }

    const existing = await this.paymentModel
      .findOne({ orderId: dto.orderId })
      .exec();
    if (existing) return existing;

    return this.paymentModel.create({
      orderId: dto.orderId,
      method: PaymentMethod.COD,
      amount: order.total,
      currency: 'NPR',
      status: PaymentTransactionStatus.PENDING,
    });
  }

  /**
   * Step 1 of the eSewa flow: validates the address + cart, prices the cart,
   * and returns signed form fields for the frontend to auto-submit straight to
   * eSewa's payment page. No Order is created yet — only a PendingCheckout
   * "intent" record, so we can create the real Order once eSewa confirms
   * payment succeeded.
   */
  async initiateEsewaCheckout(userId: string, addressId: string) {
    await this.addressService.assertOwnership(userId, addressId);
    const totals = await this.orderService.previewTotals(userId);

    const transactionUuid = uuidv4();

    await this.pendingCheckoutModel.create({
      userId,
      addressId,
      amount: totals.total,
      transactionUuid,
      status: PendingCheckoutStatus.PENDING,
    });

    return this.esewaService.buildPaymentForm({
      amount: totals.total,
      transactionUuid,
    });
  }

  /**
   * eSewa redirects the browser here (GET, base64 `data` query param) once
   * payment succeeds. Verifies the signature, then — only now — actually
   * places the order (creates Order/OrderItems, decrements stock, clears
   * cart) and records the payment as already paid.
   */
  async handleEsewaSuccess(base64Data: string) {
    const decoded = this.esewaService.decodeAndVerify(base64Data);

    if (decoded.status !== 'COMPLETE') {
      await this.failPendingCheckout(decoded.transaction_uuid);
      throw new BadRequestException(`eSewa payment status: ${decoded.status}`);
    }

    const pending = await this.pendingCheckoutModel
      .findOne({
        transactionUuid: decoded.transaction_uuid,
        status: PendingCheckoutStatus.PENDING,
      })
      .exec();

    if (!pending) {
      throw new NotFoundException(
        'No matching pending checkout found for this eSewa transaction',
      );
    }

    const { order } = await this.orderService.checkout(
      pending.userId.toString(),
      {
        addressId: pending.addressId.toString(),
        paymentMethod: OrderPaymentMethod.ESEWA,
      },
    );

    await this.paymentModel.create({
      orderId: order._id,
      method: PaymentMethod.ESEWA,
      amount: Number(decoded.total_amount) || pending.amount,
      currency: 'NPR',
      status: PaymentTransactionStatus.PAID,
      transactionUuid: decoded.transaction_uuid,
      transactionId: decoded.transaction_code,
      paidAt: new Date(),
    });

    await this.orderService.markPaymentStatus(
      order._id.toString(),
      PaymentStatus.PAID,
    );

    pending.status = PendingCheckoutStatus.CONSUMED;
    pending.orderId = order._id;
    await pending.save();

    await this.notificationService.create(
      order.userId.toString(),
      NotificationType.PAYMENT_RECEIVED,
      `Payment received for order ${order.orderNumber}.`,
    );

    return { orderId: order._id.toString(), orderNumber: order.orderNumber };
  }

  /** eSewa redirects here (GET) if the user cancels or payment fails. */
  async handleEsewaFailure(transactionUuid?: string) {
    if (transactionUuid) {
      await this.failPendingCheckout(transactionUuid);
    }
    return { status: 'failed' };
  }

  private async failPendingCheckout(transactionUuid?: string) {
    if (!transactionUuid) return;
    await this.pendingCheckoutModel
      .updateOne(
        { transactionUuid, status: PendingCheckoutStatus.PENDING },
        { status: PendingCheckoutStatus.FAILED },
      )
      .exec();
  }

  /** Admin-only fallback: confirms an already-created payment (e.g. COD collected). */
  async confirmPayment(dto: ConfirmPaymentDto) {
    const payment = await this.paymentModel.findById(dto.paymentId).exec();
    if (!payment) throw new NotFoundException('Payment not found');

    payment.status = PaymentTransactionStatus.PAID;
    payment.transactionUuid = dto.transactionId ?? payment.transactionUuid;
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

  /** Admin-only: same as `markCodPaid`, but looked up by orderId for UI convenience. */
  async markCodPaidByOrder(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId }).exec();
    if (!payment)
      throw new NotFoundException('Payment not found for this order');
    return this.markCodPaid(payment._id.toString());
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
