import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../users/enums/user-role-enum';
import { Public } from 'src/common/decorators/public.decorator';
import { EsewaService } from './esewa/esewa.service';
import { InitiateEsewaDto } from './dto/initiate-esewa.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly esewaService: EsewaService,
  ) {}

  // COD only — records a pending payment against an already-placed order.
  @Post()
  initiate(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiate(userId, dto);
  }

  // eSewa: step 1. Returns the signed form fields the frontend auto-submits
  // to redirect the user's browser to eSewa's (test/dummy) payment page.
  // No order exists yet at this point.
  @Post('esewa/initiate')
  initiateEsewa(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiateEsewaDto,
  ) {
    return this.paymentService.initiateEsewaCheckout(userId, dto.addressId);
  }

  // eSewa: step 2 (success). eSewa GET-redirects the browser here with a
  // base64 `data` param. Public because there's no JWT in this request —
  // eSewa's signature is what we trust instead. Places the order, then
  // forwards the browser on to the actual frontend success page.
  @Public()
  @Get('esewa/success')
  async esewaSuccess(@Query('data') data: string, @Res() res: Response) {
    try {
      const result = await this.paymentService.handleEsewaSuccess(data);
      const url = new URL(this.esewaService.frontendSuccessUrl);
      url.searchParams.set('orderId', result.orderId);
      url.searchParams.set('orderNumber', result.orderNumber);
      return res.redirect(url.toString());
    } catch {
      const url = new URL(this.esewaService.frontendFailureUrl);
      url.searchParams.set('reason', 'verification_failed');
      return res.redirect(url.toString());
    }
  }

  // eSewa: step 2 (failure/cancel). Same idea, just marks the pending
  // checkout as failed and sends the user back to the failure page.
  @Public()
  @Get('esewa/failure')
  async esewaFailure(@Query('data') data: string, @Res() res: Response) {
    let transactionUuid: string | undefined;
    try {
      const decoded = this.esewaService.decodeAndVerify(data);
      transactionUuid = decoded.transaction_uuid;
    } catch {
      // No usable payload — nothing to reconcile, just send the user back.
    }
    await this.paymentService.handleEsewaFailure(transactionUuid);
    const url = new URL(this.esewaService.frontendFailureUrl);
    return res.redirect(url.toString());
  }

  // NOTE: In production, gateway confirmations arrive via signed webhooks.
  // This endpoint is a manual admin fallback (e.g. confirming COD, or a
  // gateway payment that needs a manual nudge).
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

  // Same as above, but by orderId — convenient for the admin orders table,
  // which lists orders, not payment ids.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('order/:orderId/mark-cod-paid')
  markCodPaidByOrder(@Param('orderId', ParseObjectIdPipe) orderId: string) {
    return this.paymentService.markCodPaidByOrder(orderId);
  }

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
