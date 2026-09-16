import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request & { user?: JwtPayload }) {
    const adminUser = await this.prisma.unscoped.adminUser.findUniqueOrThrow({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        isPlatformAdmin: true,
        tenant: { select: { name: true, isActive: true, emailFromName: true } },
      },
    });
    return adminUser;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@Req() req: Request & { user?: JwtPayload }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user!.sub, dto);
  }
}
