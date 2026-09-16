import { IsEmail, IsString, MinLength } from 'class-validator';

// Registration creates BOTH a new Tenant and its first AdminUser (role
// "owner") together — there's no separate "create a tenant" step, since
// every admin user must belong to exactly one tenant from the moment they
// exist.
export class RegisterDto {
  @IsString()
  @MinLength(1)
  tenantName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
