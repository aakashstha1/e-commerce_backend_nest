import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schema/notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  /** Called internally by other modules (Order, Payment) to notify a user. */
  create(userId: string, type: NotificationType, message: string) {
    return this.notificationModel.create({ userId, type, message });
  }

  findAllForUser(userId: string) {
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.notificationModel
      .findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true })
      .exec();
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany(
      { userId, isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }
}
