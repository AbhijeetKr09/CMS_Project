import { PrismaClient } from './prisma/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

// 1. Initialize the adapter with your connection string
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 2. Pass the adapter into the Prisma Client
const prisma = new PrismaClient({ adapter });

export default prisma;
