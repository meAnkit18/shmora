import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { connectMongo, disconnectMongo } from '../src/db/mongo.js';
import { CourseModel } from '../src/models/CourseModel.js';
import type { Course } from '../../shared/courseTypes.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(here, '../data/courses.json');

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if (!existsSync(DATA_FILE)) {
    console.log(`No data file at ${DATA_FILE} — nothing to migrate.`);
    return;
  }
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Course[];
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log('Data file is empty — nothing to migrate.');
    return;
  }

  const claimUid = arg('--claim');
  const claimName = arg('--name');

  await connectMongo();
  let migrated = 0;
  for (const course of raw) {
    if (claimUid && course.creatorId === 'local-creator') {
      course.creatorId = claimUid;
      if (claimName) course.creatorName = claimName;
    }
    await CourseModel.replaceOne({ id: course.id }, course, { upsert: true });
    migrated++;
    console.log(`  ✓ ${course.title || course.id} (${course.status})`);
  }
  console.log(`Migrated ${migrated} course(s).`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
