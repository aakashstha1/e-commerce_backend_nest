import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../users/enums/user-role-enum';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Checkout: creates an order from the current cart
  @Post()
  checkout(@CurrentUser('userId') userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.checkout(userId, dto);
  }

  // My orders
  @Get()
  getMyOrders(
    @CurrentUser('userId') userId: string,
    @Query() query: QueryOrderDto,
  ) {
    return this.orderService.getOrdersForUser(userId, query);
  }

  // Admin: all orders across all users
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  getAllOrders(@Query() query: QueryOrderDto) {
    return this.orderService.getAllOrders(query);
  }

  @Get(':id')
  getOrderById(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.orderService.getOrderById(userId, id, role !== UserRole.ADMIN);
  }

  @Patch(':id/cancel')
  cancelOrder(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.orderService.cancelOrder(userId, id);
  }

  // Admin: transition order status
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto.status);
  }
}
