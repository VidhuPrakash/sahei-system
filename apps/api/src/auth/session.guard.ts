import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { auth } from './auth.config.js';

/**
 * Guards dashboard-facing routes with better-auth's browser session (cookie),
 * as opposed to ApiKeyGuard's shared secret for voice-service's
 * service-to-service calls. Requires an active organization on the session —
 * better-auth's organization plugin populates `activeOrganizationId` once the
 * user selects/creates one client-side.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const result = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

    if (!result) {
      throw new UnauthorizedException('Not signed in');
    }
    if (!result.session.activeOrganizationId) {
      throw new ForbiddenException('No active organization selected');
    }

    request.orgId = result.session.activeOrganizationId;
    request.userId = result.user.id;
    return true;
  }
}
