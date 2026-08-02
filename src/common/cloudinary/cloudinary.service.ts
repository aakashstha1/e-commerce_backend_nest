import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  /** Uploads a file buffer (from Multer) to Cloudinary and returns the secure URL + public_id. */
  uploadImage(
    fileBuffer: Buffer,
    folder = 'products',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result);
        },
      );
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }

  /** Deletes an image from Cloudinary by its public_id. Safe to call even if it's already gone. */
  async deleteImage(publicId: string): Promise<void> {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  }
}
