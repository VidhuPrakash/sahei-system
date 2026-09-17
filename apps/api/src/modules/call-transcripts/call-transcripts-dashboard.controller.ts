import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg } from '../../auth/current-org.decorator.js';
import { SessionGuard } from '../../auth/session.guard.js';
import { CallTranscriptsService } from './call-transcripts.service.js';
import { ListCallTranscriptsQueryDto } from './dto/list-call-transcripts-query.dto.js';

@Controller('call-transcripts')
@UseGuards(SessionGuard)
export class CallTranscriptsDashboardController {
  constructor(private readonly callTranscripts: CallTranscriptsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query() query: ListCallTranscriptsQueryDto) {
    return this.callTranscripts.findByOrgId(orgId, query);
  }
}
