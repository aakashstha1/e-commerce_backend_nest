import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Address, AddressDocument } from '../users/schema/address.schema';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
  ) {}

  async create(userId: string, dto: CreateAddressDto) {
    // If this is the user's first address, or explicitly requested, make it default
    const existingCount = await this.addressModel.countDocuments({ userId });
    const isDefault = dto.isDefault || existingCount === 0;

    if (isDefault) {
      await this.addressModel.updateMany(
        { userId },
        { $set: { isDefault: false } },
      );
    }

    return this.addressModel.create({ ...dto, userId, isDefault });
  }

  findAllForUser(userId: string) {
    return this.addressModel.find({ userId }).sort({ isDefault: -1 }).exec();
  }

  async findOneForUser(userId: string, addressId: string) {
    const address = await this.addressModel.findById(addressId).exec();
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId.toString() !== userId) {
      throw new ForbiddenException('This address does not belong to you');
    }
    return address;
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.findOneForUser(userId, addressId);

    if (dto.isDefault) {
      await this.addressModel.updateMany(
        { userId, _id: { $ne: address._id } },
        { $set: { isDefault: false } },
      );
    }

    Object.assign(address, dto);
    return address.save();
  }

  async remove(userId: string, addressId: string) {
    const address = await this.findOneForUser(userId, addressId);
    await address.deleteOne();

    // Promote another address to default if the deleted one was default
    if (address.isDefault) {
      const next = await this.addressModel.findOne({ userId }).exec();
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    return { message: 'Address deleted successfully' };
  }

  /** Used internally by OrderService to validate an address belongs to the ordering user. */
  async assertOwnership(userId: string, addressId: string) {
    const address = await this.addressModel.findById(addressId).exec();
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId.toString() !== userId) {
      throw new ForbiddenException('This address does not belong to you');
    }
    return address;
  }
}
