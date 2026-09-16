import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuoteTemplatesController } from './quote-templates.controller';
import { QuoteTemplatesService } from './quote-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [QuoteTemplatesController],
  providers: [QuoteTemplatesService],
})
export class QuoteTemplatesModule {}
