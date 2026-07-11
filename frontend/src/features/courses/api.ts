import type {
  CatalogPage, CatalogQuery, Course, CourseDraftPatch, CourseSummary,
  CourseStatus, HomeFeed, PublishIssue,
} from '@shared/courseTypes';
import { api } from '../../lib/api';

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export const fetchHomeFeed = () => api.get<HomeFeed>('/api/home-feed');

export const fetchCatalog = (q: CatalogQuery) =>
  api.get<CatalogPage>(
    '/api/courses' +
      qs({
        q: q.q, category: q.category, difficulty: q.difficulty,
        maxMinutes: q.maxMinutes, sort: q.sort, page: q.page, pageSize: q.pageSize,
      }),
  );

export const fetchCourse = (idOrSlug: string) => api.get<Course>(`/api/courses/${idOrSlug}`);

export interface DraftResponse {
  course: Course;
  issues: PublishIssue[];
}

export const listStudioCourses = (status?: CourseStatus) =>
  api.get<CourseSummary[]>('/api/studio/courses' + qs({ status }));

export const createCourseDraft = () => api.post<Course>('/api/studio/courses');
export const fetchStudioCourse = (id: string) => api.get<DraftResponse>(`/api/studio/courses/${id}`);
export const patchCourse = (id: string, patch: CourseDraftPatch) =>
  api.patch<DraftResponse>(`/api/studio/courses/${id}`, patch);
export const publishCourse = (id: string) => api.post<Course>(`/api/studio/courses/${id}/publish`);
export const unpublishCourse = (id: string) => api.post<Course>(`/api/studio/courses/${id}/unpublish`);
export const archiveCourse = (id: string) => api.post<Course>(`/api/studio/courses/${id}/archive`);
export const unarchiveCourse = (id: string) => api.post<Course>(`/api/studio/courses/${id}/unarchive`);
export const deleteCourse = (id: string) => api.del<void>(`/api/studio/courses/${id}`);
