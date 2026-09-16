export interface JwtPayload {
  sub: string; // admin user id
  tenantId: string;
  isPlatformAdmin: boolean;
}
