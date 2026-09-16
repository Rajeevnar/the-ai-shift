import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class CreateTeamMemberDto {
  @IsEmail()
  email!: string;

  // 'owner' can add/remove other team members; 'staff' has full day-to-day
  // access (quotes, clients, connectors, settings) but not that. Defaults to
  // 'staff' in the service if omitted.
  @IsOptional()
  @IsIn(['owner', 'staff'])
  role?: string;
}
