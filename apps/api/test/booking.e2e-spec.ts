import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Booking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let businessId: string;
  let serviceId: string;
  const apiKey = process.env.BOOKING_API_KEY ?? 'dev-local-booking-key';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    orgId = `org-${randomUUID()}`;
    await prisma.organization.create({
      data: { id: orgId, name: 'Test Salon Org', slug: `test-salon-${randomUUID()}`, createdAt: new Date() },
    });
    const business = await prisma.businessProfile.create({
      data: { orgId, name: 'Test Salon' },
    });
    businessId = business.id;
    const service = await prisma.service.create({
      data: { businessId, name: 'Haircut', durationMinutes: 30, price: 100 },
    });
    serviceId = service.id;
    // Tuesday, 09:00-17:00
    await prisma.businessHours.create({
      data: { businessId, dayOfWeek: 2, openTime: 540, closeTime: 1020 },
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { businessId } });
    await prisma.businessHours.deleteMany({ where: { businessId } });
    await prisma.service.deleteMany({ where: { businessId } });
    await prisma.businessProfile.deleteMany({ where: { id: businessId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await app.close();
  });

  it('rejects requests with a missing or invalid API key', async () => {
    await request(app.getHttpServer())
      .post('/booking/check-availability')
      .send({ businessId, service: 'Haircut', date: '2026-09-15', time: '10:00' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/booking/check-availability')
      .set('x-api-key', 'wrong-key')
      .send({ businessId, service: 'Haircut', date: '2026-09-15', time: '10:00' })
      .expect(401);
  });

  it('reports a slot as available before booking it', async () => {
    const res = await request(app.getHttpServer())
      .post('/booking/check-availability')
      .set('x-api-key', apiKey)
      .send({ businessId, service: 'Haircut', date: '2026-09-15', time: '10:00' })
      .expect(201);
    expect(res.body).toEqual({ available: true });
  });

  it('books an appointment and then reports that same slot as unavailable', async () => {
    const bookRes = await request(app.getHttpServer())
      .post('/booking/book-appointment')
      .set('x-api-key', apiKey)
      .set('x-customer-phone', '+919999999999')
      .send({
        businessId,
        service: 'Haircut',
        date: '2026-09-15',
        time: '11:00',
        customerName: 'Anu',
        customerArea: 'Kaloor',
      })
      .expect(201);
    expect(bookRes.body.status).toBe('confirmed');
    expect(bookRes.body.bookingReference).toMatch(/^[A-F0-9]{8}$/);

    const stored = await prisma.appointment.findUnique({
      where: { bookingReference: bookRes.body.bookingReference },
    });
    expect(stored).not.toBeNull();
    expect(stored?.serviceId).toBe(serviceId);
    expect(stored?.customerPhone).toBe('+919999999999');

    const availabilityRes = await request(app.getHttpServer())
      .post('/booking/check-availability')
      .set('x-api-key', apiKey)
      .send({ businessId, service: 'Haircut', date: '2026-09-15', time: '11:00' })
      .expect(201);
    expect(availabilityRes.body.available).toBe(false);
  });

  it('logs an inquiry', async () => {
    const res = await request(app.getHttpServer())
      .post('/booking/log-inquiry')
      .set('x-api-key', apiKey)
      .send({ businessId, category: 'off_topic', summary: 'asked about parking' })
      .expect(201);
    expect(res.body.logged).toBe(true);

    const stored = await prisma.inquiry.findUnique({ where: { id: res.body.inquiryId } });
    expect(stored?.category).toBe('OFF_TOPIC');
  });
});
