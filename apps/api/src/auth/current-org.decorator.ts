import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentOrg = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();
  // SessionGuard always sets this before a handler using @CurrentOrg() runs.
  return request.orgId!;
});
