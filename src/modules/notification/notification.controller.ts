import { Controller, Get, Param, Patch } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@CurrentUser('userId') userId: string) {
    return this.notificationService.findAllForUser(userId);
  }

  @Patch(':id/read')
  markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.notificationService.markAsRead(userId, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('userId') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }
}
