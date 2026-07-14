import type { LessonTimeline } from '@shared/timelineTypes';
import { api } from '../../lib/api';

export const fetchTimeline = (courseId: string, lessonId: string) =>
  api.get<LessonTimeline>(`/api/studio/courses/${courseId}/lessons/${lessonId}/timeline`);

export const saveTimeline = (courseId: string, lessonId: string, timeline: LessonTimeline) =>
  api.put<LessonTimeline>(
    `/api/studio/courses/${courseId}/lessons/${lessonId}/timeline`,
    timeline,
  );

export const generateTimeline = (courseId: string, lessonId: string) =>
  api.post<LessonTimeline>(
    `/api/studio/courses/${courseId}/lessons/${lessonId}/timeline/generate`,
  );
