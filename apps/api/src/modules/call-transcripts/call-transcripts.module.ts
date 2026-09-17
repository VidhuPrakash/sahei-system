import { Module } from '@nestjs/common';
import { CallTranscriptsController } from './call-transcripts.controller.js';
import { CallTranscriptsDashboardController } from './call-transcripts-dashboard.controller.js';
import { CallTranscriptsService } from './call-transcripts.service.js';

@Module({
  controllers: [CallTranscriptsController, CallTranscriptsDashboardController],
  providers: [CallTranscriptsService],
})
export class CallTranscriptsModule {}
