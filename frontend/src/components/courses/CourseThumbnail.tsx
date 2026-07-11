interface Props {
  title: string;
  seed: number;
  url?: string;
  className?: string;
}

const PALETTES = [
  ['#FF922E', '#CC5C00'],
  ['#E8A55A', '#B87018'],
  ['#5DB8A6', '#2E7D6E'],
  ['#FFB266', '#E76700'],
  ['#8E8B82', '#3D3D3A'],
  ['#D4A017', '#9C7410'],
];

export function CourseThumbnail({ title, seed, url, className = '' }: Props) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={'h-full w-full object-cover ' + className}
        loading="lazy"
      />
    );
  }
  const [from, to] = PALETTES[Math.abs(seed) % PALETTES.length];
  const angle = 115 + (Math.abs(seed >> 4) % 90);
  const initial = (title.trim()[0] ?? '?').toUpperCase();
  return (
    <div
      aria-hidden
      className={'grid h-full w-full place-items-center ' + className}
      style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
    >
      <span className="font-sketch text-5xl text-white/90 drop-shadow-sm">{initial}</span>
    </div>
  );
}
