import type { CatalogSort, CourseDifficulty } from '@shared/courseTypes';

export const CATEGORIES = [
  'Programming', 'Mathematics', 'Science', 'Data & AI', 'Design',
  'Business', 'Music', 'Languages', 'Personal Growth', 'Other',
] as const;

export const DIFFICULTIES: { id: CourseDifficulty; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Other'];

export const DURATION_FILTERS = [
  { label: 'Any length', maxMinutes: undefined },
  { label: 'Under 1 hour', maxMinutes: 60 },
  { label: 'Under 3 hours', maxMinutes: 180 },
  { label: 'Under 8 hours', maxMinutes: 480 },
] as const;

export const SORTS: { id: CatalogSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Popular' },
  { id: 'trending', label: 'Trending' },
];

export const TEACHING_STYLES = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Professional' },
  { id: 'funny', label: 'Funny' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'visual', label: 'Visual' },
  { id: 'technical', label: 'Technical' },
  { id: 'slow-paced', label: 'Slow paced' },
  { id: 'fast-paced', label: 'Fast paced' },
  { id: 'question-driven', label: 'Question driven' },
] as const;

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
