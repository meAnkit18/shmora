import type { LessonTimeline } from './timelineTypes.js';

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CourseLesson {
  id: string;
  title: string;
  summary: string;
  /** Creator-authored teaching blueprint for this lesson. */
  timeline?: LessonTimeline;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: CourseLesson[];
}

export type ExplanationDepth = 'overview' | 'balanced' | 'deep';
export type BoardPacing = 'slow' | 'medium' | 'fast';
export type BoardStyle = 'minimal' | 'rich';
export type QuizFrequency = 'never' | 'per-lesson' | 'per-section' | 'end-of-course';
export type AssessmentDifficulty = 'easy' | 'medium' | 'hard';

export interface TeachingBlueprint {
  teachingStyles: string[];
  teachingInstructions: string;
  explanation: {
    depth: ExplanationDepth;
    useExamples: boolean;
    useAnalogies: boolean;
    useCode: boolean;
    useMath: boolean;
    useAnimations: boolean;
  };
  board: {
    useDiagrams: boolean;
    useArrows: boolean;
    useFlowcharts: boolean;
    pacing: BoardPacing;
    style: BoardStyle;
    instructions: string;
  };
  assessment: {
    quizFrequency: QuizFrequency;
    homework: boolean;
    projects: boolean;
    difficulty: AssessmentDifficulty;
  };
}

export interface CourseStats {
  enrollments: number;
  rating: number | null;
  ratingCount: number;
}

export interface Course {
  id: string;
  slug: string;
  status: CourseStatus;
  version: number;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  category: string;
  difficulty: CourseDifficulty;
  language: string;
  thumbnailSeed: number;
  thumbnailUrl?: string;
  tags: string[];
  estimatedMinutes: number;
  learnOutcomes: string[];
  requirements: string[];
  sections: CourseSection[];
  blueprint: TeachingBlueprint;
  stats: CourseStats;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export type CourseSummary = Pick<
  Course,
  | 'id' | 'slug' | 'status' | 'creatorId' | 'creatorName' | 'title' | 'description'
  | 'category' | 'difficulty' | 'language' | 'thumbnailSeed' | 'thumbnailUrl' | 'tags'
  | 'estimatedMinutes' | 'stats' | 'updatedAt' | 'publishedAt'
> & { lessonCount: number };

export type CatalogSort = 'newest' | 'popular' | 'trending';

export interface CatalogQuery {
  q?: string;
  category?: string;
  difficulty?: CourseDifficulty;
  maxMinutes?: number;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}

export interface CatalogPage {
  items: CourseSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HomeFeed {
  continueLearning: CourseSummary[];
  recommended: CourseSummary[];
  popular: CourseSummary[];
  newest: CourseSummary[];
  trending: CourseSummary[];
  recentlyPublished: CourseSummary[];
}

export type CourseDraftPatch = Partial<
  Pick<
    Course,
    | 'title' | 'description' | 'category' | 'difficulty' | 'language' | 'tags'
    | 'estimatedMinutes' | 'learnOutcomes' | 'requirements' | 'sections' | 'blueprint'
    | 'thumbnailSeed'
  >
>;

export interface PublishIssue {
  field: string;
  message: string;
}
