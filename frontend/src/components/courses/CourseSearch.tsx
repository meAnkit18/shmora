import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function CourseSearch({ value, onChange, placeholder = 'Search courses…' }: Props) {
  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-soft" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search courses"
        className="h-11 w-full rounded-pill border border-hairline bg-white pl-10 pr-4 text-body-sm text-ink placeholder:text-fg-soft transition-all focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}
