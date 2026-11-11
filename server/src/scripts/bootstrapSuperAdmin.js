// ==============================================================================
// ExamSphere – Controlled Super Admin Bootstrap CLI Script
// Secure first-time setup mechanism; auto-disabled once initialized
// ==============================================================================

import { authService } from '../modules/auth/auth.service.js';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🛡️ ExamSphere Initial Super Admin Bootstrap');
  console.log('====================================================');

  try {
    const existingCount = await prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true,
        deletedAt: null,
      },
    });

    if (existingCount > 0) {
      console.log('⚠️ Platform already has active Super Admin(s). Bootstrap is permanently disabled.');
      console.log('To add additional Super Admins, log in as an existing Super Admin and use the promotion workflow.');
      process.exit(0);
    }

    // Parse command line arguments or environment variables
    const args = process.argv.slice(2);
    let name = env.INITIAL_SUPERADMIN_NAME || 'Institution Super Administrator';
    let email = env.INITIAL_SUPERADMIN_EMAIL;
    let password = env.INITIAL_SUPERADMIN_PASSWORD;
    let token = env.BOOTSTRAP_TOKEN;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) name = args[++i];
      if (args[i] === '--email' && args[i + 1]) email = args[++i];
      if (args[i] === '--password' && args[i + 1]) password = args[++i];
      if (args[i] === '--token' && args[i + 1]) token = args[++i];
    }

    if (!email || !password) {
      console.error('❌ Error: Missing credentials.');
      console.log('\nUsage:');
      console.log('  node src/scripts/bootstrapSuperAdmin.js --name "Admin Name" --email "superadmin@institution.edu" --password "StrongPass@2026"');
      console.log('  OR define INITIAL_SUPERADMIN_EMAIL and INITIAL_SUPERADMIN_PASSWORD in .env');
      process.exit(1);
    }

    console.log(`Creating initial Super Admin for '${email}'...`);

    const superAdmin = await authService.bootstrapInitialSuperAdmin({
      name,
      email,
      password,
      bootstrapToken: token,
      ipAddress: '127.0.0.1',
      userAgent: 'ExamSphere Bootstrap CLI',
    });

    console.log('\n🎉 Initial Super Admin created successfully!');
    console.log(`   ID:    ${superAdmin.id}`);
    console.log(`   Name:  ${superAdmin.name}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role:  ${superAdmin.role}`);
    console.log('\n🔒 Bootstrap is now permanently DISABLED.');
  } catch (err) {
    console.error('❌ Bootstrap failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrap();
