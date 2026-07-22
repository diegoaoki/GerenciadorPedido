import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  summary(@Query('days') days?: string) {
    const n = Math.min(365, Math.max(1, Number(days) || 30));
    return this.reports.summary(n);
  }
}

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
