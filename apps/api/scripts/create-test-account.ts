import { PrismaClient } from '@prisma/client';
import { auth } from '../src/auth/auth.config.js';

const prisma = new PrismaClient();

const TEST_EMAIL = 'info@krishna.com';
const TEST_PASSWORD = 'Pass@123,.';
const TEST_NAME = 'Krishna Test Owner';
const ORG_SLUG = 'krishna-hair-salon';
const ROLE = 'owner';

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    throw new Error(
      `No organization with slug "${ORG_SLUG}" found. Run "pnpm --filter api db:seed" first.`,
    );
  }

  const signUp = await auth.api.signUpEmail({
    body: { name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  await auth.api.addMember({
    body: { userId: signUp.user.id, organizationId: org.id, role: ROLE },
  });

  console.log(`Created test account ${TEST_EMAIL} as ${ROLE} of "${org.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
