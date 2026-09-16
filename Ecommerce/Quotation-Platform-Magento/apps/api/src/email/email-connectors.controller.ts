import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailConnectorsService } from './email-connectors.service';
import { ConnectEmailDto } from './dto/connect-email.dto';

@UseGuards(JwtAuthGuard)
@Controller('email-connector')
export class EmailConnectorsController {
  constructor(private readonly emailConnectors: EmailConnectorsService) {}

  @Get()
  get() {
    return this.emailConnectors.get();
  }

  @Post('test')
  test(@Body() dto: ConnectEmailDto) {
    return this.emailConnectors.test(dto);
  }

  @Post('connect')
  connect(@Body() dto: ConnectEmailDto) {
    return this.emailConnectors.connect(dto);
  }

  @Delete()
  remove() {
    return this.emailConnectors.remove();
  }
}
