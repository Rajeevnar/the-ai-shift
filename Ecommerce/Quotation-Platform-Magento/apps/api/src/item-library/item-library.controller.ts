import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ItemLibraryService } from './item-library.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@UseGuards(JwtAuthGuard)
@Controller('item-library')
export class ItemLibraryController {
  constructor(private readonly items: ItemLibraryService) {}

  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.items.create(dto);
  }

  @Get()
  list() {
    return this.items.list();
  }

  // Registered before the ':id' route below so 'search' isn't swallowed
  // as a literal item id.
  @Get('search')
  search(@Query('q') q?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    const toInt = (value: string | undefined, fallback: number) => {
      if (!value) return fallback;
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };
    return this.items.search(q || undefined, toInt(skip, 0), toInt(take, 100));
  }

  @Post('refresh-from-connectors')
  refreshFromConnectors() {
    return this.items.refreshFromConnectors();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.items.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.items.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.items.remove(id);
  }
}
