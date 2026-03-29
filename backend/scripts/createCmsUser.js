/**
 * CLI script to create CMS users (journalists, editors, admins).
 * Run from the backend directory:
 *
 *   npx tsx scripts/createCmsUser.js --name "Jane Doe" --email jane@example.com --password secret123 --role EDITOR
 *
 * Roles: JOURNALIST (default), EDITOR, ADMIN
 */

import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.js';

const args = process.argv.slice(2);
const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
};

const name     = get('--name');
const email    = get('--email');
const password = get('--password');
const role     = (get('--role') || 'JOURNALIST').toUpperCase();

const VALID_ROLES = ['JOURNALIST', 'EDITOR', 'ADMIN'];

if (!name || !email || !password) {
    console.error('Usage: node scripts/createCmsUser.js --name "Name" --email email@x.com --password pass --role JOURNALIST');
    process.exit(1);
}

if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.cmsUser.upsert({
    where: { email },
    update: { name, passwordHash, role },
    create: { email, name, passwordHash, role }
});

console.log(`\n✅ CMS User created/updated:`);
console.log(`   ID    : ${user.id}`);
console.log(`   Name  : ${user.name}`);
console.log(`   Email : ${user.email}`);
console.log(`   Role  : ${user.role}\n`);

await prisma.$disconnect();
