import { PhoneNumberProvisioningStatus, PhoneNumberType, PlanTier, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_SLUG = 'krishna-hair-salon';
const PHONE_NUMBER = '+919513886363';

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    throw new Error(
      `No organization with slug "${ORG_SLUG}" found. Run "pnpm --filter api db:seed" first.`,
    );
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { planTier: PlanTier.PRO },
  });

  const existingNumber = await prisma.orgPhoneNumber.findFirst({ where: { orgId: org.id } });
  const numberData = {
    phoneNumber: PHONE_NUMBER,
    numberType: PhoneNumberType.MOBILE,
    provisioningStatus: PhoneNumberProvisioningStatus.PURCHASED,
  };
  if (existingNumber) {
    await prisma.orgPhoneNumber.update({ where: { id: existingNumber.id }, data: numberData });
  } else {
    await prisma.orgPhoneNumber.create({ data: { orgId: org.id, ...numberData } });
  }

  console.log(`Set "${org.name}" to ${PlanTier.PRO} plan with number ${PHONE_NUMBER}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
