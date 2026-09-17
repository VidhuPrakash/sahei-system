import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureAuth } from '../src/configure-auth.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Call transcripts (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const originHeader = { Origin: 'http://localhost:3000' };

  let agentA: ReturnType<typeof request.agent>;
  let orgIdA: string;
  let callIdA: string;

  let agentB: ReturnType<typeof request.agent>;
  let orgIdB: string;
  let callIdB: string;

  async function setUpOrgWithTranscript(callId: string) {
    const agent = request.agent(app.getHttpServer());
    const email = `call-transcripts-${randomUUID()}@example.com`;

    await agent
      .post('/api/auth/sign-up/email')
      .send({ name: 'Org Owner', email, password: 'correct-horse-battery' })
      .expect(200);

    const orgRes = await agent
      .post('/api/auth/organization/create')
      .set(originHeader)
      .send({ name: 'Call Transcripts Test Org', slug: `call-transcripts-test-${randomUUID()}` })
      .expect(200);
    const orgId = orgRes.body.id;

    const profileRes = await agent
      .post('/business-profile')
      .send({ name: 'Test Business', businessHours: [{ dayOfWeek: 1, openTime: 540, closeTime: 1080 }] })
      .expect(201);
    const businessId = profileRes.body.id;

    await prisma.callTranscript.create({
      data: {
        businessId,
        callId,
        customerPhone: '+919999999999',
        outcome: 'BOOKED',
        bookingReference: 'ABCD1234',
        transcript: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
        startedAt: new Date('2026-09-15T04:00:00.000Z'),
        endedAt: new Date('2026-09-15T04:05:00.000Z'),
      },
    });

    return { agent, orgId };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureAuth(app);
    await app.init();
    prisma = app.get(PrismaService);

    callIdA = `call-a-${randomUUID()}`;
    callIdB = `call-b-${randomUUID()}`;

    ({ agent: agentA, orgId: orgIdA } = await setUpOrgWithTranscript(callIdA));
    ({ agent: agentB, orgId: orgIdB } = await setUpOrgWithTranscript(callIdB));
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgIdA, orgIdB] } } });
    await app.close();
  });

  it('only returns transcripts belonging to the calling org', async () => {
    const resA = await agentA.get('/call-transcripts').expect(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].callId).toBe(callIdA);

    const resB = await agentB.get('/call-transcripts').expect(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].callId).toBe(callIdB);
  });

  it('rejects a signed-out request', async () => {
    await request(app.getHttpServer()).get('/call-transcripts').expect(401);
  });
});
