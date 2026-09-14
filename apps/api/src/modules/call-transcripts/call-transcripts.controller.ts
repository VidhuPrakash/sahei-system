import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../booking/api-key.guard.js';
import { CallTranscriptsService } from './call-transcripts.service.js';
import { CreateCallTranscriptDto } from './dto/create-call-transcript.dto.js';

@Controller('call-transcripts')
@UseGuards(ApiKeyGuard)
export class CallTranscriptsController {
  constructor(private readonly callTranscripts: CallTranscriptsService) {}

  @Post()
  create(@Body() dto: CreateCallTranscriptDto) {
    return this.callTranscripts.create(dto);
  }

  @Get(':callId')
  findByCallId(@Param('callId') callId: string) {
    return this.callTranscripts.findByCallId(callId);
  }
}
