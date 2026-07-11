import { Router } from 'express';
import type { Request, Response } from 'express';
import type { CatalogQuery, CourseDraftPatch } from '../../../shared/courseTypes.js';
import {
  archiveCourse, createDraft, deleteCourse, getOwned, getPublicCourse, homeFeed,
  HttpError, listOwned, LOCAL_CREATOR, publishCourse, publishIssues, queryCatalog,
  unarchiveCourse, unpublishCourse, updateCourse,
} from '../services/courseService.js';

export const coursesRouter = Router();

function creator(_req: Request): { id: string; name: string } {
  return LOCAL_CREATOR;
}

function handle(res: Response, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error('[courses]', err);
  res.status(500).json({ message: 'Unexpected error' });
}

coursesRouter.get('/api/home-feed', (_req, res) => {
  res.json(homeFeed());
});

coursesRouter.get('/api/courses', (req, res) => {
  const q: CatalogQuery = {
    q: req.query.q as string | undefined,
    category: req.query.category as string | undefined,
    difficulty: req.query.difficulty as CatalogQuery['difficulty'],
    maxMinutes: req.query.maxMinutes ? Number(req.query.maxMinutes) : undefined,
    sort: req.query.sort as CatalogQuery['sort'],
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
  };
  res.json(queryCatalog(q));
});

coursesRouter.get('/api/courses/:idOrSlug', (req, res) => {
  try {
    res.json(getPublicCourse(req.params.idOrSlug, creator(req).id));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.get('/api/studio/courses', (req, res) => {
  const status = req.query.status as 'draft' | 'published' | 'archived' | undefined;
  res.json(listOwned(creator(req).id, status));
});

coursesRouter.post('/api/studio/courses', (req, res) => {
  const c = creator(req);
  res.status(201).json(createDraft(c.id, c.name));
});

coursesRouter.get('/api/studio/courses/:id', (req, res) => {
  try {
    const course = getOwned(req.params.id, creator(req).id);
    res.json({ course, issues: publishIssues(course) });
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.patch('/api/studio/courses/:id', (req, res) => {
  try {
    const course = updateCourse(req.params.id, creator(req).id, req.body as CourseDraftPatch);
    res.json({ course, issues: publishIssues(course) });
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post('/api/studio/courses/:id/publish', (req, res) => {
  try {
    res.json(publishCourse(req.params.id, creator(req).id));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post('/api/studio/courses/:id/unpublish', (req, res) => {
  try {
    res.json(unpublishCourse(req.params.id, creator(req).id));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post('/api/studio/courses/:id/archive', (req, res) => {
  try {
    res.json(archiveCourse(req.params.id, creator(req).id));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post('/api/studio/courses/:id/unarchive', (req, res) => {
  try {
    res.json(unarchiveCourse(req.params.id, creator(req).id));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.delete('/api/studio/courses/:id', (req, res) => {
  try {
    deleteCourse(req.params.id, creator(req).id);
    res.status(204).end();
  } catch (err) {
    handle(res, err);
  }
});
