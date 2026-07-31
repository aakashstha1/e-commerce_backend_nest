import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
// import { Product, ProductDocument } from '../product/schema/product.schema';

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    // @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    const existing = await this.categoryModel.findOne({ slug }).exec();
    if (existing)
      throw new ConflictException('A category with this slug already exists');

    if (dto.parentId) {
      const parent = await this.categoryModel.findById(dto.parentId).exec();
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    return this.categoryModel.create({ ...dto, slug });
  }

  findAll() {
    return this.categoryModel.find().sort({ name: 1 }).exec();
  }

  /** Returns categories organized as a parent -> children tree, useful for storefront navigation. */
  async findTree() {
    const categories = await this.categoryModel
      .find()
      .sort({ name: 1 })
      .lean()
      .exec();
    const byId = new Map(
      categories.map((c) => [
        c._id.toString(),
        { ...c, children: [] as any[] },
      ]),
    );
    const roots: any[] = [];

    for (const cat of byId.values()) {
      if (cat.parentId) {
        const parent = byId.get(cat.parentId.toString());
        if (parent) {
          parent.children.push(cat);
        } else {
          roots.push(cat);
        }
      } else {
        roots.push(cat);
      }
    }
    return roots;
  }

  async findOne(id: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    if (dto.slug || dto.name) {
      const slug = slugify(dto.slug ?? dto.name!);
      const existing = await this.categoryModel
        .findOne({ slug, _id: { $ne: id } })
        .exec();
      if (existing)
        throw new ConflictException('A category with this slug already exists');
      category.slug = slug;
    }

    if (dto.name) category.name = dto.name;
    if (dto.parentId !== undefined) category.parentId = dto.parentId as any;

    return category.save();
  }

  async remove(id: string) {
    const hasChildren = await this.categoryModel.exists({ parentId: id });
    if (hasChildren) {
      throw new BadRequestException(
        'Cannot delete a category that has subcategories. Reassign or delete them first.',
      );
    }

    // const hasProducts = await this.productModel.exists({ categoryId: id });
    // if (hasProducts) {
    //   throw new BadRequestException(
    //     'Cannot delete a category that still has products assigned to it. Reassign or remove them first.',
    //   );
    // }

    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) throw new NotFoundException('Category not found');
    return { message: 'Category deleted successfully' };
  }
}
