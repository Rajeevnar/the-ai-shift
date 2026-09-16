import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    // Forgot-password needs EmailService to send the reset link — EmailModule
    // itself imports AuthModule (for JwtAuthGuard on its own controller),
    // so this is a genuine circular dependency, resolved the standard
    // Nest way via forwardRef on both sides (see email.module.ts).
    forwardRef(() => EmailModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
