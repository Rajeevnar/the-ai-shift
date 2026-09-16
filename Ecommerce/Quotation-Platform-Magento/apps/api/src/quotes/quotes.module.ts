import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
