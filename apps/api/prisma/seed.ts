import { AppointmentStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'krishna-salon-org' },
    update: {},
    create: {
      id: 'krishna-salon-org',
      name: 'Krishna Hair Salon',
      slug: 'krishna-hair-salon',
      createdAt: new Date(),
    },
  });

  const business = await prisma.businessProfile.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      id: 'krishna-hair-salon',
      orgId: org.id,
      name: 'Krishna Hair Salon',
      nameLocal: 'കൃഷ്ണ ഹെയർ സലൂൺ',
      location: 'moonam valav, Ernakulam',
      description:
        'Hair & beauty salon in Ernakulam offering haircuts, hair coloring, facials, and beauty treatments.',
      notes:
        'Free parking available in front of the shop. Walk-ins welcome, but booking is recommended on weekends. Cash and card both accepted.',
    },
  });

  const serviceDefs = [
    { name: 'Haircut', nameLocal: 'ഹെയർകട്ട്', durationMinutes: 30, price: '300.00' },
    { name: 'Hair Coloring', nameLocal: 'ഹെയർ കളറിംഗ്', durationMinutes: 90, price: '1500.00' },
    { name: 'Facial', nameLocal: 'ഫേഷ്യൽ', durationMinutes: 45, price: '800.00' },
    {
      name: 'Beauty Treatment',
      nameLocal: 'ബ്യൂട്ടി ട്രീറ്റ്മെന്റുകൾ',
      durationMinutes: 60,
      price: '1200.00',
    },
  ];

  const services = await Promise.all(
    serviceDefs.map((service) => {
      const id = `${business.id}-${service.name.toLowerCase().replace(/\s+/g, '-')}`;
      return prisma.service.upsert({
        where: { id },
        update: {},
        create: {
          id,
          businessId: business.id,
          ...service,
        },
      });
    }),
  );

  await Promise.all(
    Array.from({ length: 7 }, (_, dayOfWeek) =>
      prisma.businessHours.upsert({
        where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek } },
        update: {},
        create: {
          businessId: business.id,
          dayOfWeek,
          openTime: 9 * 60,
          closeTime: 20 * 60,
        },
      }),
    ),
  );

  const haircut = services.find((s) => s.name === 'Haircut');
  if (!haircut) {
    throw new Error('Haircut service missing from seed data');
  }

  await prisma.appointment.upsert({
    where: { bookingReference: 'SEED0001' },
    update: {},
    create: {
      businessId: business.id,
      serviceId: haircut.id,
      customerName: 'Anjali Menon',
      customerPhone: '+919812345678',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      bookingReference: 'SEED0001',
    },
  });

  console.log(
    `Seeded business profile "${business.name}" with ${services.length} services.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
