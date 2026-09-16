import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectorsService } from './connectors.service';
import { ConnectMagentoDto } from './dto/connect-magento.dto';
import { ImportProductsDto } from './dto/import-products.dto';

@UseGuards(JwtAuthGuard)
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectors: ConnectorsService) {}

  @Post('magento/connect')
  connectMagento(@Body() dto: ConnectMagentoDto) {
    return this.connectors.connectMagento(dto);
  }

  @Post('magento/test')
  testMagento(@Body() dto: ConnectMagentoDto) {
    return this.connectors.testMagento(dto);
  }

  @Get()
  list() {
    return this.connectors.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.connectors.get(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.connectors.remove(id);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.connectors.sync(id);
  }

  @Get(':id/products')
  listProducts(@Param('id') id: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    // Parsed manually rather than via ParseIntPipe: that pipe throws a
    // "numeric string is expected" validation error for anything other
    // than a clean digit string (including a stray empty-string query
    // param), which is a confusing failure for what's just a pagination
    // hint. Anything not cleanly parseable just falls back to undefined
    // (the service's own default) instead of hard-failing the request.
    const toInt = (value?: string) => {
      if (!value) return undefined;
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    };
    return this.connectors.listProducts(id, toInt(skip), toInt(take));
  }

  @Post(':id/import')
  importToLibrary(@Param('id') id: string, @Body() dto: ImportProductsDto) {
    return this.connectors.importToLibrary(id, dto);
  }

  @Post(':id/import-all')
  importAllFromConnector(@Param('id') id: string) {
    return this.connectors.importAllFromConnector(id);
  }
}
