import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureAuth } from '../src/configure-auth.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { BusinessProfileService } from '../src/modules/business-profile/business-profile.service.js';

describe('Multi-tenant org isolation (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let businessProfileService: BusinessProfileService;

  let orgAId: string;
  let orgBId: string;
  let businessAId: string;
  let businessBId: string;
  let agentA: ReturnType<typeof request.agent>;
  let agentB: ReturnType<typeof request.agent>;

  const originHeader = { Origin: 'http://localhost:3000' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureAuth(app);
    await app.init();
    prisma = app.get(PrismaService);
    businessProfileService = app.get(BusinessProfileService);

    agentA = request.agent(app.getHttpServer());
    agentB = request.agent(app.getHttpServer());

    const emailA = `owner-a-${randomUUID()}@example.com`;
    const emailB = `owner-b-${randomUUID()}@example.com`;

    await agentA
      .post('/api/auth/sign-up/email')
      .send({ name: 'Org A Owner', email: emailA, password: 'correct-horse-battery' })
      .expect(200);

    await agentB
      .post('/api/auth/sign-up/email')
      .send({ name: 'Org B Owner', email: emailB, password: 'correct-horse-battery' })
      .expect(200);

    const orgARes = await agentA
      .post('/api/auth/organization/create')
      .set(originHeader)
      .send({ name: 'Org A', slug: `org-a-${randomUUID()}` })
      .expect(200);
    orgAId = orgARes.body.id;

    const orgBRes = await agentB
      .post('/api/auth/organization/create')
      .set(originHeader)
      .send({ name: 'Org B', slug: `org-b-${randomUUID()}` })
      .expect(200);
    orgBId = orgBRes.body.id;

    const businessA = await prisma.businessProfile.create({
      data: { orgId: orgAId, name: 'Org A Business' },
    });
    businessAId = businessA.id;
    const serviceA = await prisma.service.create({
      data: { businessId: businessAId, name: 'Haircut', durationMinutes: 30, price: 100 },
    });
    await prisma.appointment.create({
      data: {
        businessId: businessAId,
        serviceId: serviceA.id,
        customerName: 'Anu',
        customerPhone: '+919999999999',
        scheduledAt: new Date('2026-09-15T05:30:00.000Z'),
        bookingReference: `A${randomUUID().slice(0, 7).toUpperCase()}`,
      },
    });

    const businessB = await prisma.businessProfile.create({
      data: { orgId: orgBId, name: 'Org B Business' },
    });
    businessBId = businessB.id;
    const serviceB = await prisma.service.create({
      data: { businessId: businessBId, name: 'Manicure', durationMinutes: 45, price: 150 },
    });
    await prisma.appointment.create({
      data: {
        businessId: businessBId,
        serviceId: serviceB.id,
        customerName: 'Beena',
        customerPhone: '+918888888888',
        scheduledAt: new Date('2026-09-15T06:00:00.000Z'),
        bookingReference: `B${randomUUID().slice(0, 7).toUpperCase()}`,
      },
    });
  });

  afterAll(async () => {
    const ids = [orgAId, orgBId].filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it('scopes BusinessProfile lookups to the owning org only', async () => {
    const bizA = await businessProfileService.findByOrgId(orgAId);
    const bizB = await businessProfileService.findByOrgId(orgBId);

    expect(bizA?.id).toBe(businessAId);
    expect(bizB?.id).toBe(businessBId);
    expect(bizA?.id).not.toBe(bizB?.id);

    const rowsForOrgA = await prisma.businessProfile.findMany({ where: { orgId: orgAId } });
    expect(rowsForOrgA).toHaveLength(1);
    expect(rowsForOrgA[0]?.id).toBe(businessAId);
  });

  it('never returns one org’s appointments when queried by the other org’s businessId', async () => {
    const appointmentsForA = await prisma.appointment.findMany({ where: { businessId: businessAId } });
    const appointmentsForB = await prisma.appointment.findMany({ where: { businessId: businessBId } });

    expect(appointmentsForA).toHaveLength(1);
    expect(appointmentsForB).toHaveLength(1);
    expect(appointmentsForA[0]?.customerName).toBe('Anu');
    expect(appointmentsForB[0]?.customerName).toBe('Beena');
  });

  it('lists only the caller’s own organization via the auth session', async () => {
    const listA = await agentA.get('/api/auth/organization/list').expect(200);
    const listB = await agentB.get('/api/auth/organization/list').expect(200);

    expect(listA.body.map((org: { id: string }) => org.id)).toEqual([orgAId]);
    expect(listB.body.map((org: { id: string }) => org.id)).toEqual([orgBId]);
  });
});
