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
  ) {}
  // Creates a new product and its associated images in the database. Validates uniqueness of slug and SKU.
  async create(dto: CreateProductDto) {
    const { images, ...productData } = dto;
    const slug = slugify(dto.slug ?? dto.name);

    const existingSlug = await this.productModel.findOne({ slug }).exec();
    if (existingSlug)
      throw new ConflictException('A product with this slug already exists');

    const existingSku = await this.productModel
      .findOne({ sku: dto.sku.toUpperCase() })
      .exec();
    if (existingSku)
      throw new ConflictException('A product with this SKU already exists');

    const product = await this.productModel.create({ ...productData, slug });

    if (images?.length) {
      await this.productImageModel.insertMany(
        images.map((img) => ({ ...img, productId: product._id })),
      );
    }

    return this.findOne(product._id.toString());
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
    const { images, ...productData } = dto;
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

    Object.assign(product, productData);
    await product.save();

    if (images) {
      await this.productImageModel.deleteMany({ productId: id });
      if (images.length) {
        await this.productImageModel.insertMany(
          images.map((img) => ({ ...img, productId: id })),
        );
      }
    }

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
