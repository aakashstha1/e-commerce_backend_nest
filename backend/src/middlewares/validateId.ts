import { BadRequestException } from '@nestjs/common';
import mongoose from 'mongoose';

const validateId = (id: string) => {
  const isValid = mongoose.Types.ObjectId.isValid(id);

  if (!isValid) throw new BadRequestException('Invalid ID');
};

export default validateId;
