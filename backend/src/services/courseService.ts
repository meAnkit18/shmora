import { randomUUID } from 'node:crypto';
import type {
  CatalogPage,
  CatalogQuery,
  Course,
  CourseDraftPatch,
  CourseSummary,
  HomeFeed,
  PublishIssue,
  TeachingBlueprint,
} from '../../../shared/courseTypes.js';
import { courseStore } from '../state/courseStore.js';

function assertOwner(course: Course, creatorId: string): void {
  if (course.creatorId !== creatorId) throw new HttpError(403, 'Not your course.');
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function defaultBlueprint(): TeachingBlueprint {
  return {
    teachingStyles: [],
    teachingInstructions: '',
    explanation: {
      depth: 'balanced',
      useExamples: true,
      useAnalogies: true,
      useCode: false,
      useMath: false,
      useAnimations: true,
    },
    board: {
      useDiagrams: true,
      useArrows: true,
      useFlowcharts: false,
      pacing: 'medium',
      style: 'minimal',
      instructions: '',
    },
    assessment: {
      quizFrequency: 'per-section',
      homework: false,
      projects: false,
      difficulty: 'medium',
    },
  };
}

export async function createDraft(creatorId: string, creatorName: string): Promise<Course> {
  const now = Date.now();
  const course: Course = {
    id: randomUUID(),
    slug: '',
    status: 'draft',
    version: 0,
    creatorId,
    creatorName,
    title: '',
    description: '',
    category: '',
    difficulty: 'beginner',
    language: 'English',
    thumbnailSeed: Math.floor(Math.random() * 2 ** 31),
    tags: [],
    estimatedMinutes: 60,
    learnOutcomes: [],
    requirements: [],
    sections: [],
    blueprint: defaultBlueprint(),
    stats: { enrollments: 0, rating: null, ratingCount: 0 },
    createdAt: now,
    updatedAt: now,
  };
  await courseStore.set(course);
  return course;
}

const EDITABLE: (keyof CourseDraftPatch)[] = [
  'title', 'description', 'category', 'difficulty', 'language', 'tags',
  'estimatedMinutes', 'learnOutcomes', 'requirements', 'sections', 'blueprint',
  'thumbnailSeed',
];

export async function updateCourse(
  id: string,
  creatorId: string,
  patch: CourseDraftPatch,
): Promise<Course> {
  const course = await getOwned(id, creatorId);
  if (course.status === 'archived') throw new HttpError(409, 'Unarchive the course to edit it.');
  for (const key of EDITABLE) {
    if (key in patch) {
      (course as unknown as Record<string, unknown>)[key] = (patch as unknown as Record<string, unknown>)[key];
    }
  }
  course.updatedAt = Date.now();
  await courseStore.set(course);
  return course;
}

export async function getOwned(id: string, creatorId: string): Promise<Course> {
  const course = await courseStore.get(id);
  if (!course) throw new HttpError(404, 'Course not found.');
  assertOwner(course, creatorId);
  return course;
}

export async function listOwned(
  creatorId: string,
  status?: Course['status'],
): Promise<CourseSummary[]> {
  const all = await courseStore.all();
  return all
    .filter((c) => c.creatorId === creatorId && (!status || c.status === status))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toSummary);
}

export async function deleteCourse(id: string, creatorId: string): Promise<void> {
  const course = await getOwned(id, creatorId);
  if (course.status === 'published') {
    throw new HttpError(409, 'Unpublish the course before deleting it.');
  }
  await courseStore.delete(id);
}

export function publishIssues(course: Course): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (course.title.trim().length < 4) {
    issues.push({ field: 'title', message: 'Give the course a title (at least 4 characters).' });
  }
  if (course.description.trim().length < 30) {
    issues.push({ field: 'description', message: 'Write a description of at least 30 characters.' });
  }
  if (!course.category) issues.push({ field: 'category', message: 'Pick a category.' });
  const lessonCount = course.sections.reduce((n, s) => n + s.lessons.length, 0);
  if (course.sections.length === 0 || lessonCount === 0) {
    issues.push({ field: 'sections', message: 'Add at least one section with one lesson.' });
  }
  if (course.blueprint.teachingStyles.length === 0) {
    issues.push({ field: 'blueprint', message: 'Pick at least one teaching style.' });
  }
  if (course.blueprint.teachingInstructions.trim().length < 20) {
    issues.push({
      field: 'blueprint',
      message: 'Teaching instructions are what make this AI teacher yours — write at least a sentence or two.',
    });
  }
  return issues;
}

async function slugify(title: string): Promise<string> {
  const base = title.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'course';
  let slug = base;
  let i = 2;
  while (await courseStore.getBySlug(slug)) slug = `${base}-${i++}`;
  return slug;
}

export async function publishCourse(id: string, creatorId: string): Promise<Course> {
  const course = await getOwned(id, creatorId);
  const issues = publishIssues(course);
  if (issues.length) {
    throw new HttpError(422, issues.map((i) => i.message).join(' '));
  }
  if (!course.slug) course.slug = await slugify(course.title);
  course.status = 'published';
  course.version += 1;
  course.publishedAt = Date.now();
  course.updatedAt = Date.now();
  await courseStore.set(course);
  return course;
}

export async function unpublishCourse(id: string, creatorId: string): Promise<Course> {
  const course = await getOwned(id, creatorId);
  course.status = 'draft';
  course.updatedAt = Date.now();
  await courseStore.set(course);
  return course;
}

export async function archiveCourse(id: string, creatorId: string): Promise<Course> {
  const course = await getOwned(id, creatorId);
  course.status = 'archived';
  course.updatedAt = Date.now();
  await courseStore.set(course);
  return course;
}

export async function unarchiveCourse(id: string, creatorId: string): Promise<Course> {
  const course = await getOwned(id, creatorId);
  course.status = 'draft';
  course.updatedAt = Date.now();
  await courseStore.set(course);
  return course;
}

export function toSummary(c: Course): CourseSummary {
  return {
    id: c.id,
    slug: c.slug,
    status: c.status,
    creatorId: c.creatorId,
    creatorName: c.creatorName,
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    language: c.language,
    thumbnailSeed: c.thumbnailSeed,
    thumbnailUrl: c.thumbnailUrl,
    tags: c.tags,
    estimatedMinutes: c.estimatedMinutes,
    stats: c.stats,
    updatedAt: c.updatedAt,
    publishedAt: c.publishedAt,
    lessonCount: c.sections.reduce((n, s) => n + s.lessons.length, 0),
  };
}

function trendingScore(c: Course): number {
  const ageDays = (Date.now() - (c.publishedAt ?? c.updatedAt)) / 86_400_000;
  return c.stats.enrollments / Math.max(1, ageDays / 7 + 1);
}

export async function queryCatalog(q: CatalogQuery): Promise<CatalogPage> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, q.pageSize ?? 12));
  const needle = q.q?.trim().toLowerCase();

  const all = await courseStore.all();
  let items = all.filter((c) => c.status === 'published');
  if (needle) {
    items = items.filter((c) =>
      [c.title, c.description, c.creatorName, ...c.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }
  if (q.category) items = items.filter((c) => c.category === q.category);
  if (q.difficulty) items = items.filter((c) => c.difficulty === q.difficulty);
  if (q.maxMinutes) items = items.filter((c) => c.estimatedMinutes <= q.maxMinutes!);

  const sort = q.sort ?? 'newest';
  items.sort((a, b) => {
    if (sort === 'popular') return b.stats.enrollments - a.stats.enrollments;
    if (sort === 'trending') return trendingScore(b) - trendingScore(a);
    return (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize).map(toSummary),
    total,
    page,
    pageSize,
  };
}

export async function getPublicCourse(idOrSlug: string, creatorId: string): Promise<Course> {
  const course =
    (await courseStore.get(idOrSlug)) ?? (await courseStore.getBySlug(idOrSlug));
  if (!course) throw new HttpError(404, 'Course not found.');
  if (course.status !== 'published' && course.creatorId !== creatorId) {
    throw new HttpError(404, 'Course not found.');
  }
  return course;
}

export async function homeFeed(): Promise<HomeFeed> {
  const pick = (sort: CatalogQuery['sort']) =>
    queryCatalog({ sort, pageSize: 10 }).then((p) => p.items);
  const [newest, trending, popular] = await Promise.all([
    pick('newest'),
    pick('trending'),
    pick('popular'),
  ]);
  return {
    continueLearning: [],
    recommended: trending,
    popular,
    newest,
    trending,
    recentlyPublished: newest,
  };
}
