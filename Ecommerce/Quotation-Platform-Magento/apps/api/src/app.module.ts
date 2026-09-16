import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ItemLibraryModule } from './item-library/item-library.module';
import { QuotesModule } from './quotes/quotes.module';
import { QuoteTemplatesModule } from './quote-templates/quote-templates.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { EmailModule } from './email/email.module';
import { SettingsModule } from './settings/settings.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { TeamModule } from './team/team.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    // Generous global default, matching a similar internal product's own
    // choice — protects every endpoint from accidental floods or scripted
    // abuse without affecting normal usage. A tighter per-route limit can be
    // added later for any endpoint that turns out to be expensive (e.g.
    // connector sync, PDF generation), the same way that other product
    // tightened its own chat endpoint.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    ConfigModule,
    PrismaModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    ClientsModule,
    ItemLibraryModule,
    QuotesModule,
    QuoteTemplatesModule,
    ConnectorsModule,
    EmailModule,
    SettingsModule,
    PlatformAdminModule,
    TeamModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, TenantMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Runs on every request, resolving and establishing the tenant context
    // (if a valid token is present) before any guard/controller executes.
    // See TenantMiddleware for why this — not a Guard — is where that has
    // to happen. Registered explicitly in `providers` above so its
    // JwtService dependency resolves from AuthModule's exported JwtModule.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
