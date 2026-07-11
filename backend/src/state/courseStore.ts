import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Course } from '../../../shared/courseTypes.js';

export interface CourseStore {
  all(): Course[];
  get(id: string): Course | undefined;
  getBySlug(slug: string): Course | undefined;
  set(course: Course): void;
  delete(id: string): void;
}

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, '../../data');
const DATA_FILE = resolve(DATA_DIR, 'courses.json');
const FLUSH_DELAY_MS = 400;

class JsonFileCourseStore implements CourseStore {
  private courses = new Map<string, Course>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      if (existsSync(DATA_FILE)) {
        const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
        if (Array.isArray(raw)) {
          for (const c of raw as Course[]) this.courses.set(c.id, c);
        }
      }
    } catch (err) {
      console.error('[courseStore] failed to load data file, starting empty:', err);
    }
  }

  all(): Course[] {
    return [...this.courses.values()];
  }

  get(id: string): Course | undefined {
    return this.courses.get(id);
  }

  getBySlug(slug: string): Course | undefined {
    for (const c of this.courses.values()) if (c.slug === slug) return c;
    return undefined;
  }

  set(course: Course): void {
    this.courses.set(course.id, course);
    this.scheduleFlush();
  }

  delete(id: string): void {
    this.courses.delete(id);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      try {
        mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(DATA_FILE, JSON.stringify(this.all(), null, 2));
      } catch (err) {
        console.error('[courseStore] flush failed:', err);
      }
    }, FLUSH_DELAY_MS);
    this.flushTimer.unref?.();
  }
}

export const courseStore: CourseStore = new JsonFileCourseStore();
