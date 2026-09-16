import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailConnectorsController } from './email-connectors.controller';
import { EmailConnectorsService } from './email-connectors.service';
import { EmailService } from './email.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [EmailConnectorsController],
  providers: [EmailConnectorsService, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
