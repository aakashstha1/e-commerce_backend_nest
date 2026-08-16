import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schema/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Product, ProductDocument } from '../product/schema/product.schema';

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

type LeanCategory = Category & { _id: Types.ObjectId };
type CategoryTree = LeanCategory & { children: CategoryTree[] };

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    const existing = await this.categoryModel.findOne({ slug }).exec();
    if (existing) {
      throw new ConflictException('A category with this slug already exists');
    }

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
  async findTree(): Promise<CategoryTree[]> {
    const categories = (await this.categoryModel
      .find()
      .sort({ name: 1 })
      .lean()
      .exec()) as LeanCategory[];

    const byId = new Map<string, CategoryTree>(
      categories.map((c) => [c._id.toString(), { ...c, children: [] }]),
    );
    const roots: CategoryTree[] = [];

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

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (await this.wouldCreateCycle(id, dto.parentId)) {
        throw new BadRequestException(
          'Cannot set parent: this would create a circular category reference',
        );
      }
    }

    if (dto.slug || dto.name) {
      const slug = slugify(dto.slug ?? dto.name!);
      const existing = await this.categoryModel
        .findOne({ slug, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new ConflictException('A category with this slug already exists');
      }
      category.slug = slug;
    }

    if (dto.name) category.name = dto.name;
    if (dto.parentId !== undefined) {
      category.parentId = dto.parentId
        ? new Types.ObjectId(dto.parentId)
        : null;
    }

    return category.save();
  }

  async remove(id: string) {
    const hasChildren = await this.categoryModel.exists({ parentId: id });
    if (hasChildren) {
      throw new BadRequestException(
        'Cannot delete a category that has subcategories. Reassign or delete them first.',
      );
    }

    const hasProducts = await this.productModel.exists({ categoryId: id });
    if (hasProducts) {
      throw new BadRequestException(
        'Cannot delete a category that still has products assigned to it. Reassign or remove them first.',
      );
    }

    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) throw new NotFoundException('Category not found');
    return { message: 'Category deleted successfully' };
  }

  /**
   * Walks up the ancestor chain from `newParentId` to check whether `categoryId`
   * appears anywhere in it. If it does, applying `newParentId` as the parent of
   * `categoryId` would create a cycle in the tree.
   */
  private async wouldCreateCycle(
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    let currentId: string | null = newParentId;

    while (currentId) {
      if (currentId === categoryId) return true;

      const current = await this.categoryModel
        .findById(currentId)
        .select('parentId')
        .lean()
        .exec();

      currentId = current?.parentId ? current.parentId.toString() : null;
    }

    return false;
  }
}
