import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schema/product.schema';
import {
  ProductImage,
  ProductImageDocument,
} from './schema/product-image.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(ProductImage.name)
    private productImageModel: Model<ProductImageDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Creates a new product and its associated images in the database. Validates uniqueness of slug and SKU.

  async create(dto: CreateProductDto, thumbnailBuffer?: Buffer) {
    const slug = slugify(dto.slug ?? dto.name);

    const existingSlug = await this.productModel.findOne({ slug }).exec();
    if (existingSlug)
      throw new ConflictException('A product with this slug already exists');

    const existingSku = await this.productModel
      .findOne({ sku: dto.sku.toUpperCase() })
      .exec();
    if (existingSku)
      throw new ConflictException('A product with this SKU already exists');

    let thumbnail: string | undefined;
    let thumbnailPublicId: string | undefined;

    if (thumbnailBuffer) {
      const uploadResult = await this.cloudinaryService.uploadImage(
        thumbnailBuffer,
        'products/thumbnails',
      );
      thumbnail = uploadResult.secure_url;
      thumbnailPublicId = uploadResult.public_id;
    }

    const product = await this.productModel.create({
      ...dto,
      slug,
      thumbnail,
      thumbnailPublicId,
    });

    return this.findOne(product._id.toString());
  }

  async updateThumbnail(productId: string, thumbnailBuffer: Buffer) {
    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException('Product not found');

    // Delete the old thumbnail from Cloudinary before uploading the new one.
    if (product.thumbnailPublicId) {
      await this.cloudinaryService.deleteImage(product.thumbnailPublicId);
    }

    const uploadResult = await this.cloudinaryService.uploadImage(
      thumbnailBuffer,
      'products/thumbnails',
    );

    product.thumbnail = uploadResult.secure_url;
    product.thumbnailPublicId = uploadResult.public_id;
    await product.save();

    return product;
  }

  // Retrieves a paginated list of products based on the provided query parameters.
  async findAll(query: QueryProductDto) {
    const {
      page = 1,
      limit = 20,
      sort = 'desc',
      sortBy = 'createdAt',
      search,
      categoryId,
      brand,
      minPrice,
      maxPrice,
    } = query;

    const filter: Record<string, any> = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    if (brand) filter.brand = brand;
    if (search) filter.$text = { $search: search };
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (minPrice !== undefined) priceFilter['$gte'] = minPrice;
      if (maxPrice !== undefined) priceFilter['$lte'] = maxPrice;
      filter.price = priceFilter;
    }

    const skip = (page - 1) * limit;
    const sortDir = sort === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Retrieves a single product by its ID, including its associated images.
  async findOne(id: string) {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found');

    const images = await this.productImageModel
      .find({ productId: id })
      .sort({ sortOrder: 1 })
      .exec();

    return { ...product.toObject(), images };
  }

  async findBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug, isActive: true })
      .exec();
    if (!product) throw new NotFoundException('Product not found');

    const images = await this.productImageModel
      .find({ productId: product._id })
      .sort({ sortOrder: 1 })
      .exec();

    return { ...product.toObject(), images };
  }

  // Updates an existing product and its associated images in the database.
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found');

    if (dto.slug || dto.name) {
      const slug = slugify(dto.slug ?? dto.name!);
      const existing = await this.productModel
        .findOne({ slug, _id: { $ne: id } })
        .exec();
      if (existing)
        throw new ConflictException('A product with this slug already exists');
      product.slug = slug;
    }

    Object.assign(product, dto);
    await product.save();

    return this.findOne(id);
  }

  // Deactivates a product by setting its isActive field to false.
  async remove(id: string) {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { returnDocument: 'after' },
    );
    if (!product) throw new NotFoundException('Product not found');
    return { message: 'Product deactivated successfully' };
  }

  /** Uploads a new image for a product and stores it as a ProductImage document. */
  async addImage(productId: string, fileBuffer: Buffer, sortOrder = 0) {
    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException('Product not found');

    const uploadResult = await this.cloudinaryService.uploadImage(fileBuffer);

    const image = await this.productImageModel.create({
      productId,
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      sortOrder,
    });

    return image;
  }

  /** Deletes a product image from both Cloudinary and the database. */
  async removeImage(productId: string, imageId: string) {
    const image = await this.productImageModel
      .findOne({ _id: imageId, productId })
      .exec();
    if (!image) throw new NotFoundException('Image not found for this product');

    await this.cloudinaryService.deleteImage(image.publicId);
    await image.deleteOne();

    return { message: 'Image deleted successfully' };
  }

  /** Replaces an existing image: deletes the old Cloudinary asset, uploads the new one in its place. */
  async replaceImage(productId: string, imageId: string, fileBuffer: Buffer) {
    const image = await this.productImageModel
      .findOne({ _id: imageId, productId })
      .exec();
    if (!image) throw new NotFoundException('Image not found for this product');

    // Delete the old file from Cloudinary before uploading the new one.
    await this.cloudinaryService.deleteImage(image.publicId);

    const uploadResult = await this.cloudinaryService.uploadImage(fileBuffer);
    image.imageUrl = uploadResult.secure_url;
    image.publicId = uploadResult.public_id;
    await image.save();

    return image;
  }

  /** Deletes every image for a product from Cloudinary — used before a hard delete. */
  async removeAllImages(productId: string) {
    const images = await this.productImageModel.find({ productId }).exec();
    await Promise.all(
      images.map((img) => this.cloudinaryService.deleteImage(img.publicId)),
    );
    await this.productImageModel.deleteMany({ productId });
  }

  /** Atomically deducts stock; throws if insufficient. Used by OrderService during checkout. */
  async decrementStock(productId: string, quantity: number, session?: any) {
    const product = await this.productModel
      .findOneAndUpdate(
        { _id: productId, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { new: true, session },
      )
      .exec();

    if (!product) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}`,
      );
    }
    return product;
  }

  /** Restores stock, e.g. on order cancellation. */
  async incrementStock(productId: string, quantity: number, session?: any) {
    return this.productModel
      .findByIdAndUpdate(
        productId,
        { $inc: { stockQuantity: quantity } },
        { new: true, session },
      )
      .exec();
  }

  // Adjusts the stock quantity of a product.
  async adjustStock(productId: string, quantity: number) {
    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException('Product not found');

    if (product.stockQuantity + quantity < 0) {
      throw new BadRequestException('Resulting stock cannot be negative');
    }

    product.stockQuantity += quantity;
    return product.save();
  }
}
