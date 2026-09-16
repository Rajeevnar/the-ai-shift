import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

// Every credential field is OPTIONAL — leave them all blank when updating
// an existing connector to just change the base URL/label while keeping
// the already-saved (encrypted) credentials. If ANY OAuth field is
// provided, all four are required together; same for the two admin
// fields. Providing both an OAuth field and an admin field is rejected —
// see ConnectorsService.resolveMagentoCredentials.
export class ConnectMagentoDto {
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  consumerKey?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  consumerSecret?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accessToken?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  accessTokenSecret?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  adminUsername?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
