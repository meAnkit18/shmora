import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load the repo-root .env regardless of the process working directory.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? 'https://opencode.ai/zen/v1',
    apiKey: required('AI_API_KEY'),
    model: process.env.AI_MODEL ?? 'north-mini-code-free',
  },
};
