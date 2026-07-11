import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogPage, CatalogQuery, Course, CourseDraftPatch, CourseStatus,
  CourseSummary, HomeFeed, PublishIssue,
} from '@shared/courseTypes';
import {
  fetchCatalog, fetchCourse, fetchHomeFeed, fetchStudioCourse,
  listStudioCourses, patchCourse,
} from './api';

interface Async<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, loading: false, error: null }),
      (err: Error) => alive && setState({ data: null, loading: false, error: err.message }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export const useHomeFeed = () => useAsync<HomeFeed>(fetchHomeFeed, []);

export const useCatalog = (q: CatalogQuery) =>
  useAsync<CatalogPage>(
    () => fetchCatalog(q),
    [q.q, q.category, q.difficulty, q.maxMinutes, q.sort, q.page, q.pageSize],
  );

export const useCourse = (idOrSlug: string | undefined) =>
  useAsync<Course | null>(
    () => (idOrSlug ? fetchCourse(idOrSlug) : Promise.resolve(null)),
    [idOrSlug],
  );

export const useStudioCourses = (status?: CourseStatus) =>
  useAsync<CourseSummary[]>(() => listStudioCourses(status), [status]);

export type SaveState = 'saved' | 'saving' | 'error';

export function useCourseDraft(id: string | undefined) {
  const [course, setCourse] = useState<Course | null>(null);
  const [issues, setIssues] = useState<PublishIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pending = useRef<CourseDraftPatch>({});
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchStudioCourse(id).then(
      ({ course: c, issues: i }) => {
        if (!alive) return;
        setCourse(c);
        setIssues(i);
        setLoading(false);
      },
      (err: Error) => {
        if (!alive) return;
        setError(err.message);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(() => {
    if (!id || !Object.keys(pending.current).length) return;
    const patch = pending.current;
    pending.current = {};
    setSaveState('saving');
    patchCourse(id, patch).then(
      ({ course: c, issues: i }) => {
        setIssues(i);
        setCourse({ ...c, ...(pending.current as Partial<Course>) });
        if (Object.keys(pending.current).length) flush();
        else setSaveState('saved');
      },
      () => setSaveState('error'),
    );
  }, [id]);

  const update = useCallback(
    (patch: CourseDraftPatch) => {
      setCourse((prev) => (prev ? { ...prev, ...patch } : prev));
      pending.current = { ...pending.current, ...patch };
      setSaveState('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 600);
    },
    [flush],
  );

  return { course, setCourse, issues, loading, error, saveState, update, flush };
}
