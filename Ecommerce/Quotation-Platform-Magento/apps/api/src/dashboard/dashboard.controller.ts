import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(@Query('since') since?: string) {
    const parsed = since ? new Date(since) : undefined;
    return this.dashboard.overview(parsed && !isNaN(parsed.getTime()) ? parsed : undefined);
  }
}
