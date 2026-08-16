import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from '../users/enums/user-role-enum';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List categories',
    description:
      'Returns a flat list sorted by name, or a nested parent/child tree when tree=true.',
  })
  @ApiQuery({
    name: 'tree',
    required: false,
    description: 'Set to "true" to return categories as a nested tree',
    example: 'true',
  })
  findAll(@Query('tree') tree?: string) {
    return tree === 'true'
      ? this.categoryService.findTree()
      : this.categoryService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single category by ID' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoryService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new category (admin only)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category (admin only)' })
  @ApiParam({ name: 'id', description: 'Category MongoDB ObjectId' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.categoryService.remove(id);
  }
}
