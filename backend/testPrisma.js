import { PrismaClient } from './prisma/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

import 'dotenv/config';
console.log("Environment URL: ", process.env.DATABASE_URL);

try {
    const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    const prisma = new PrismaClient({ adapter });
    console.log("Client successfully created!");
} catch (err) {
    console.log("Initialization Error: ", err.message);
}
