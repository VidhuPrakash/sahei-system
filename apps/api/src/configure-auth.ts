import { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/auth.config.js';

// better-auth reads the raw request body itself, so this must run against an
// app created with `{ bodyParser: false }`, before Nest's global body parser
// is re-enabled. Express 5 requires a named wildcard segment (`*splat`), not
// bare `*`. Shared by main.ts and e2e tests, since @nestjs/testing's
// createNestApplication() bypasses main.ts's bootstrap() entirely.
export function configureAuth(app: NestExpressApplication): void {
  app.use('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });
}
