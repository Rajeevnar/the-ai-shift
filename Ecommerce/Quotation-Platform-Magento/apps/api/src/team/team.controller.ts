import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamService } from './team.service';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

@UseGuards(JwtAuthGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list() {
    return this.team.list();
  }

  @Post()
  create(@Body() dto: CreateTeamMemberDto) {
    return this.team.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.team.remove(id);
  }
}
