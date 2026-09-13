import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Guards service-to-service calls from voice-service. There is no cookie
 * session to check here (better-auth's org/session flow is for the
 * browser-facing dashboard) — a shared secret in `x-api-key` is the only
 * auth this route needs.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers["x-api-key"];
    const expected = process.env.BOOKING_API_KEY;

    if (!expected || provided !== expected) {
      throw new UnauthorizedException("Invalid or missing API key");
    }
    return true;
  }
}
