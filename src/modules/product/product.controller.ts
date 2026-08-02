import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../users/enums/user-role-enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}
  // Query the database for all products
  @Public()
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAll(query);
  }

  // Query the database for a product by slug
  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile() thumbnail?: Express.Multer.File,
  ) {
    return this.productService.create(dto, thumbnail?.buffer);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/thumbnail')
  @UseInterceptors(FileInterceptor('thumbnail', { storage: memoryStorage() }))
  updateThumbnail(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() thumbnail: Express.Multer.File,
  ) {
    if (!thumbnail) throw new BadRequestException('No file uploaded');
    return this.productService.updateThumbnail(id, thumbnail.buffer);
  }
  // Query the database for a product by ID
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productService.findOne(id);
  }

  // Update an existing product in the database
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  // Adjust the stock of a product
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/stock')
  adjustStock(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productService.adjustStock(id, dto.quantity);
  }

  // Delete a product from the database
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productService.remove(id);
  }
}
