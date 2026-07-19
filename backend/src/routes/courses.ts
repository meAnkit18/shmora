import { Router } from 'express';
import type { Response } from 'express';
import type { CatalogQuery, CourseDraftPatch } from '../../../shared/courseTypes.js';
import {
  archiveCourse, createDraft, deleteCourse, getOwned, getPublicCourse, homeFeed,
  HttpError, listOwned, publishCourse, publishIssues, queryCatalog,
  unarchiveCourse, unpublishCourse, updateCourse,
} from '../services/courseService.js';
import {
  generateTimeline,
  getTimeline,
  saveTimeline,
} from '../services/timelineService.js';
import { optionalAuth, requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const coursesRouter = Router();

function creator(req: AuthedRequest): { id: string; name: string } {
  return { id: req.user!.uid, name: req.user!.name };
}

function handle(res: Response, err: unknown): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error('[courses]', err);
  res.status(500).json({ message: 'Unexpected error' });
}

// ---- Public catalog ----

coursesRouter.get('/api/home-feed', async (_req, res) => {
  try {
    res.json(await homeFeed());
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.get('/api/courses', async (req, res) => {
  try {
    const q: CatalogQuery = {
      q: req.query.q as string | undefined,
      category: req.query.category as string | undefined,
      difficulty: req.query.difficulty as CatalogQuery['difficulty'],
      maxMinutes: req.query.maxMinutes ? Number(req.query.maxMinutes) : undefined,
      sort: req.query.sort as CatalogQuery['sort'],
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    };
    res.json(await queryCatalog(q));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.get('/api/courses/:idOrSlug', optionalAuth, async (req: AuthedRequest, res) => {
  try {
    res.json(await getPublicCourse(req.params.idOrSlug, req.user?.uid ?? ''));
  } catch (err) {
    handle(res, err);
  }
});

// ---- Studio (authenticated) ----

coursesRouter.get('/api/studio/courses', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const status = req.query.status as 'draft' | 'published' | 'archived' | undefined;
    res.json(await listOwned(creator(req).id, status));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post('/api/studio/courses', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const c = creator(req);
    res.status(201).json(await createDraft(c.id, c.name));
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.get('/api/studio/courses/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const course = await getOwned(req.params.id, creator(req).id);
    res.json({ course, issues: publishIssues(course) });
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.patch('/api/studio/courses/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const course = await updateCourse(
      req.params.id,
      creator(req).id,
      req.body as CourseDraftPatch,
    );
    res.json({ course, issues: publishIssues(course) });
  } catch (err) {
    handle(res, err);
  }
});

coursesRouter.post(
  '/api/studio/courses/:id/publish',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await publishCourse(req.params.id, creator(req).id));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.post(
  '/api/studio/courses/:id/unpublish',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await unpublishCourse(req.params.id, creator(req).id));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.post(
  '/api/studio/courses/:id/archive',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await archiveCourse(req.params.id, creator(req).id));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.post(
  '/api/studio/courses/:id/unarchive',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await unarchiveCourse(req.params.id, creator(req).id));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.delete('/api/studio/courses/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await deleteCourse(req.params.id, creator(req).id);
    res.status(204).end();
  } catch (err) {
    handle(res, err);
  }
});

// ---- Lesson timelines ----

coursesRouter.get(
  '/api/studio/courses/:id/lessons/:lessonId/timeline',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await getTimeline(req.params.id, creator(req).id, req.params.lessonId));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.put(
  '/api/studio/courses/:id/lessons/:lessonId/timeline',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await saveTimeline(req.params.id, creator(req).id, req.params.lessonId, req.body));
    } catch (err) {
      handle(res, err);
    }
  },
);

coursesRouter.post(
  '/api/studio/courses/:id/lessons/:lessonId/timeline/generate',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      res.json(await generateTimeline(req.params.id, creator(req).id, req.params.lessonId));
    } catch (err) {
      handle(res, err);
    }
  },
);
