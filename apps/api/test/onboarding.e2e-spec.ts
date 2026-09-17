import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureAuth } from '../src/configure-auth.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Onboarding status (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let orgId: string;
  let agent: ReturnType<typeof request.agent>;

  const originHeader = { Origin: 'http://localhost:3000' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureAuth(app);
    await app.init();
    prisma = app.get(PrismaService);

    agent = request.agent(app.getHttpServer());
    const email = `onboarding-${randomUUID()}@example.com`;

    await agent
      .post('/api/auth/sign-up/email')
      .send({ name: 'Onboarding Owner', email, password: 'correct-horse-battery' })
      .expect(200);

    const orgRes = await agent
      .post('/api/auth/organization/create')
      .set(originHeader)
      .send({ name: 'Onboarding Test Org', slug: `onboarding-test-${randomUUID()}` })
      .expect(200);
    orgId = orgRes.body.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await app.close();
  });

  it('walks nextStep through business-profile -> plan -> phone-number -> complete', async () => {
    const initial = await agent.get('/organizations/me/onboarding-status').expect(200);
    expect(initial.body).toMatchObject({
      complete: false,
      nextStep: 'business-profile',
      businessProfile: { complete: false },
      plan: { tier: null, selected: false },
      phoneNumber: { provisioningStatus: null, complete: false },
    });

    await agent
      .post('/business-profile')
      .send({
        name: 'Onboarding Test Business',
        businessHours: [{ dayOfWeek: 1, openTime: 540, closeTime: 1080 }],
      })
      .expect(201);

    const afterProfile = await agent.get('/organizations/me/onboarding-status').expect(200);
    expect(afterProfile.body).toMatchObject({
      complete: false,
      nextStep: 'plan',
      businessProfile: { complete: true },
    });

    await agent.post('/organizations/me/plan').send({ planTier: 'STARTER' }).expect(201);

    const afterPlan = await agent.get('/organizations/me/onboarding-status').expect(200);
    expect(afterPlan.body).toMatchObject({
      complete: false,
      nextStep: 'phone-number',
      plan: { tier: 'STARTER', selected: true },
    });

    // Simulate a successfully purchased number directly, without calling the
    // real Exotel API (no EXOTEL_* credentials in this test environment).
    await prisma.orgPhoneNumber.create({
      data: { orgId, provisioningStatus: 'PURCHASED', phoneNumber: '+911234567890' },
    });

    const afterPhoneNumber = await agent.get('/organizations/me/onboarding-status').expect(200);
    expect(afterPhoneNumber.body).toMatchObject({
      complete: true,
      nextStep: null,
      phoneNumber: { provisioningStatus: 'PURCHASED', complete: true },
    });
  });
});
