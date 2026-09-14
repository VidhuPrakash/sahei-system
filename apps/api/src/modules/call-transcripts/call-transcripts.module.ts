import { Module } from '@nestjs/common';
import { CallTranscriptsController } from './call-transcripts.controller.js';
import { CallTranscriptsService } from './call-transcripts.service.js';

@Module({
  controllers: [CallTranscriptsController],
  providers: [CallTranscriptsService],
})
export class CallTranscriptsModule {}
