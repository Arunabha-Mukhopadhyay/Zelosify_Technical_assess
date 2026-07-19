import prisma from "../config/prisma/prisma.js";

async function run() {
  await prisma.user.update({
    where: { id: 'c7e7ff04-0696-480d-89bf-e108772fb027' },
    data: { firstName: 'Hiring', lastName: 'Manager' }
  });
  console.log('✅ Name updated to Hiring Manager');
  process.exit(0);
}
run();
