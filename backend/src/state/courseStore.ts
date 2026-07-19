import type { Course } from '../../../shared/courseTypes.js';
import { CourseModel } from '../models/CourseModel.js';

export interface CourseStore {
  all(): Promise<Course[]>;
  get(id: string): Promise<Course | undefined>;
  getBySlug(slug: string): Promise<Course | undefined>;
  set(course: Course): Promise<void>;
  delete(id: string): Promise<void>;
}

function clean(doc: Record<string, unknown> | null): Course | undefined {
  if (!doc) return undefined;
  const { _id, ...rest } = doc;
  return rest as unknown as Course;
}

class MongoCourseStore implements CourseStore {
  async all(): Promise<Course[]> {
    const docs = await CourseModel.find().lean();
    return docs.map((d) => clean(d as unknown as Record<string, unknown>)!) as Course[];
  }

  async get(id: string): Promise<Course | undefined> {
    return clean(await CourseModel.findOne({ id }).lean() as unknown as Record<string, unknown> | null);
  }

  async getBySlug(slug: string): Promise<Course | undefined> {
    if (!slug) return undefined;
    return clean(await CourseModel.findOne({ slug }).lean() as unknown as Record<string, unknown> | null);
  }

  async set(course: Course): Promise<void> {
    await CourseModel.replaceOne({ id: course.id }, course as unknown as Record<string, unknown>, { upsert: true });
  }

  async delete(id: string): Promise<void> {
    await CourseModel.deleteOne({ id });
  }
}

export const courseStore: CourseStore = new MongoCourseStore();
