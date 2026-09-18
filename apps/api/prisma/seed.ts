import { AppointmentStatus, CallOutcome, InquiryCategory, PrismaClient } from '@prisma/client';

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

  const now = Date.now();
  const minutes = (n: number) => n * 60 * 1000;
  const hours = (n: number) => n * 60 * minutes(1);
  const days = (n: number) => n * 24 * hours(1);

  const callTranscripts = [
    {
      callId: 'SEED-CALL-0001',
      customerPhone: '+919812345678',
      outcome: CallOutcome.BOOKED,
      bookingReference: 'SEED0001',
      startedAt: new Date(now - days(1)),
      endedAt: new Date(now - days(1) + minutes(3)),
      transcript: [
        { role: 'assistant', content: 'നമസ്കാരം, കൃഷ്ണ ഹെയർ സലൂണിലേക്ക് സ്വാഗതം. ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?' },
        { role: 'user', content: 'എനിക്ക് നാളെ ഒരു ഹെയർകട്ട് ബുക്ക് ചെയ്യണം.' },
        { role: 'assistant', content: 'തീർച്ചയായും. നാളെ ഏത് സമയമാണ് നിങ്ങൾക്ക് സൗകര്യം?' },
        { role: 'user', content: 'വൈകുന്നേരം 5 മണിക്ക് പറ്റുമോ?' },
        { role: 'assistant', content: '5 മണിക്ക് സ്ലോട്ട് ലഭ്യമാണ്. നിങ്ങളുടെ പേര് പറയാമോ?' },
        { role: 'user', content: 'അഞ്ജലി മേനോൻ.' },
        {
          role: 'assistant',
          content: 'നന്ദി അഞ്ജലി. നാളെ വൈകുന്നേരം 5 മണിക്ക് ഹെയർകട്ട് ബുക്ക് ചെയ്തിട്ടുണ്ട്. ബുക്കിംഗ് റഫറൻസ് SEED0001.',
        },
      ],
    },
    {
      callId: 'SEED-CALL-0002',
      customerPhone: '+919845012345',
      outcome: CallOutcome.INQUIRY,
      bookingReference: null,
      startedAt: new Date(now - hours(3)),
      endedAt: new Date(now - hours(3) + minutes(2)),
      transcript: [
        { role: 'assistant', content: 'നമസ്കാരം, കൃഷ്ണ ഹെയർ സലൂൺ. എങ്ങനെ സഹായിക്കാം?' },
        { role: 'user', content: 'ഹെയർ കളറിംഗിന് എത്ര രൂപയാകും?' },
        { role: 'assistant', content: 'ഹെയർ കളറിംഗിന് 1500 രൂപയാണ്, 90 മിനിറ്റ് സമയമെടുക്കും.' },
        { role: 'user', content: 'ശരി, കടയുടെ സമയം എന്താണ്?' },
        { role: 'assistant', content: 'രാവിലെ 9 മുതൽ രാത്രി 8 വരെയാണ് പ്രവർത്തന സമയം, എല്ലാ ദിവസവും.' },
        { role: 'user', content: 'നന്ദി, ഞാൻ പിന്നീട് വിളിക്കാം.' },
      ],
    },
    {
      callId: 'SEED-CALL-0003',
      customerPhone: '+919900112233',
      outcome: CallOutcome.NO_OUTCOME,
      bookingReference: null,
      startedAt: new Date(now - hours(1)),
      endedAt: new Date(now - hours(1) + minutes(1)),
      transcript: [
        { role: 'assistant', content: 'നമസ്കാരം, കൃഷ്ണ ഹെയർ സലൂൺ. എങ്ങനെ സഹായിക്കാം?' },
        { role: 'user', content: 'ഹലോ... ഹലോ?' },
      ],
    },
    {
      callId: 'SEED-CALL-0004',
      customerPhone: '+919876543210',
      outcome: CallOutcome.BOOKED,
      bookingReference: 'SEED0002',
      startedAt: new Date(now - days(2)),
      endedAt: new Date(now - days(2) + minutes(3)),
      transcript: [
        { role: 'assistant', content: 'നമസ്കാരം, കൃഷ്ണ ഹെയർ സലൂൺ. എങ്ങനെ സഹായിക്കാം?' },
        { role: 'user', content: 'എനിക്ക് ഒരു ഫേഷ്യൽ ബുക്ക് ചെയ്യണം.' },
        { role: 'assistant', content: 'തീർച്ചയായും. ഏത് ദിവസമാണ് സൗകര്യം?' },
        { role: 'user', content: 'വെള്ളിയാഴ്ച ഉച്ചയ്ക്ക് ശേഷം.' },
        {
          role: 'assistant',
          content: 'വെള്ളിയാഴ്ച ഉച്ചയ്ക്ക് 2 മണിക്ക് ഫേഷ്യൽ ബുക്ക് ചെയ്തിട്ടുണ്ട്. റഫറൻസ് നമ്പർ SEED0002.',
        },
      ],
    },
  ];

  await Promise.all(
    callTranscripts.map((call) =>
      prisma.callTranscript.upsert({
        where: { callId: call.callId },
        update: {},
        create: {
          businessId: business.id,
          callId: call.callId,
          customerPhone: call.customerPhone,
          outcome: call.outcome,
          bookingReference: call.bookingReference,
          transcript: call.transcript,
          startedAt: call.startedAt,
          endedAt: call.endedAt,
        },
      }),
    ),
  );

  const inquiries: { id: string; category: InquiryCategory; summary: string; createdAt: Date }[] = [
    {
      id: 'seed-inquiry-0001',
      category: InquiryCategory.BUSINESS_QUESTION,
      summary: 'Asked the price and duration of hair coloring before deciding whether to book.',
      createdAt: new Date(now - hours(3)),
    },
    {
      id: 'seed-inquiry-0002',
      category: InquiryCategory.BUSINESS_QUESTION,
      summary: 'Asked whether walk-ins are accepted or booking ahead is required.',
      createdAt: new Date(now - days(1)),
    },
    {
      id: 'seed-inquiry-0003',
      category: InquiryCategory.OFF_TOPIC,
      summary: 'Wrong number, looking for a different business.',
      createdAt: new Date(now - hours(1)),
    },
  ];

  await Promise.all(
    inquiries.map((inquiry) =>
      prisma.inquiry.upsert({
        where: { id: inquiry.id },
        update: {},
        create: {
          id: inquiry.id,
          businessId: business.id,
          category: inquiry.category,
          summary: inquiry.summary,
          createdAt: inquiry.createdAt,
        },
      }),
    ),
  );

  console.log(
    `Seeded business profile "${business.name}" with ${services.length} services, ${callTranscripts.length} call transcripts, and ${inquiries.length} inquiries.`,
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
