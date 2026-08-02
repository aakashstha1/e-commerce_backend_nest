import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../users/enums/user-role-enum';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  initiate(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiate(userId, dto);
  }

  // NOTE: In production, gateway confirmations arrive via signed webhooks
  // (Stripe webhook, eSewa/Khalti verification callback) — not directly from
  // the client. This endpoint is a stand-in until those handlers are wired up,
  // and is admin-gated in the meantime to prevent self-confirmation fraud.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('confirm')
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.paymentService.confirmPayment(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/fail')
  fail(@Param('id', ParseObjectIdPipe) id: string) {
    return this.paymentService.markFailed(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/mark-cod-paid')
  markCodPaid(@Param('id', ParseObjectIdPipe) id: string) {
    return this.paymentService.markCodPaid(id);
  }

  // NOTE: In production, this endpoint is gated by the order's ownership and
  @Get('order/:orderId')
  getByOrder(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
  ) {
    return this.paymentService.getByOrder(
      userId,
      orderId,
      role === UserRole.ADMIN,
    );
  }
}
