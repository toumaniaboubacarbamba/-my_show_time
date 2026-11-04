import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { UploadedImageFile } from '../common/types/uploaded-image-file';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  uploadImage(file: UploadedImageFile): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'my-show-time/posters', resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload échoué'));
          resolve(result);
        },
      );
      stream.end(file.buffer);
    });
  }
}