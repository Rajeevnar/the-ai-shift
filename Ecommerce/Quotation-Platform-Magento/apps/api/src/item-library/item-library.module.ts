import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ItemLibraryController } from './item-library.controller';
import { ItemLibraryService } from './item-library.service';

@Module({
  imports: [AuthModule],
  controllers: [ItemLibraryController],
  providers: [ItemLibraryService],
})
export class ItemLibraryModule {}
