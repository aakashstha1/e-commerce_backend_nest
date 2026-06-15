//Creating a  Custom Pipe
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import mongoose from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform {
  transform(value: string) {
    // Check if the provided value is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid ID');
    }

    return value;
  }
}
