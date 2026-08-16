import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schema/payment.schema';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { OrderModule } from '../order/order.module';
import { NotificationModule } from '../notification/notification.module';
import { EsewaService } from './esewa/esewa.service';
import {
  PendingCheckout,
  PendingCheckoutSchema,
} from './schema/pending-checkout.schema';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PendingCheckout.name, schema: PendingCheckoutSchema },
    ]),
    OrderModule,
    NotificationModule,
    AddressModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EsewaService],
  exports: [PaymentService],
})
export class PaymentModule {}
