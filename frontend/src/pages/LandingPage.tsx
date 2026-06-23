import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SharpenerGlyph } from '../components/SharpenerGlyph';

/* ── Icons ──────────────────────────────────────────────────────────────── */
function MenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: 'How it Works', href: '#how' },
  { label: "Why It's Different", href: '#why' },
  { label: 'Examples', href: '#examples' },
  { label: 'Pricing', href: '#start' },
];

const PROBLEMS = [
  { label: 'Search Engines', body: 'Information scattered across dozens of sources. No structure, no progression, no way to ask questions.' },
  { label: 'Video Platforms', body: 'One-way communication at a fixed pace. The teacher cannot adapt, and you cannot interrupt.' },
  { label: 'Online Courses', body: 'Pre-recorded. The same experience for every learner. Questions are delayed or go unanswered.' },
  { label: 'AI Chatbots', body: 'Answers questions but never actively teaches. No structure — it reacts rather than leads.' },
];

const STEPS = [
  { title: 'Start a lesson', body: 'Type any topic — from binary search to music theory, from React hooks to quantum mechanics.' },
  { title: 'Your teacher explains', body: 'The AI teaches with natural voice and a live whiteboard, drawing diagrams and walking through it step by step.' },
  { title: 'Interrupt anytime', body: 'Ask anything mid-lesson. The teacher pauses, answers, then picks up exactly where it left off.' },
];

/* ── Navbar ─────────────────────────────────────────────────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 h-[72px] border-b border-hairline bg-canvas/70 backdrop-blur-md">
      <nav className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6 lg:px-10">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <SharpenerGlyph size={38} className="text-brand transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105" />
          <span className="font-sketch text-2xl leading-none text-ink">shmora</span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="group relative text-nav-link text-fg-muted transition-colors duration-200 hover:text-ink">
              {l.label}
              <span className="absolute -bottom-1.5 left-0 h-0.5 w-0 rounded-pill bg-brand transition-all duration-300 ease-out group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/session"
            className="hidden rounded-[14px] bg-brand px-5 py-3 text-button text-white shadow-[0_4px_16px_rgba(255,122,0,0.28)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-active hover:shadow-[0_10px_28px_rgba(255,122,0,0.4)] active:translate-y-0 sm:inline-flex"
          >
            Start Learning →
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-card md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* mobile sheet */}
      {open && (
        <div className="border-b border-hairline bg-canvas px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-2 py-2.5 text-title-sm text-body transition-colors hover:bg-surface-card hover:text-ink">
                {l.label}
              </a>
            ))}
            <Link to="/session" onClick={() => setOpen(false)} className="mt-2 rounded-[14px] bg-brand px-5 py-3 text-center text-button text-white">
              Start Learning →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Dark mockup (used in the “Examples” band) ──────────────────────────── */
function LessonMockup() {
  return (
    <div className="overflow-hidden rounded-xl bg-dark p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-pill bg-on-dark-soft/40" />
          <span className="h-2.5 w-2.5 rounded-pill bg-on-dark-soft/40" />
          <span className="h-2.5 w-2.5 rounded-pill bg-on-dark-soft/40" />
        </span>
        <span className="text-caption text-on-dark-soft">Binary Search · live lesson</span>
        <span className="ml-auto flex items-center gap-1.5 text-caption text-on-dark-soft">
          <span className="h-2 w-2 rounded-pill bg-success" />
          listening
        </span>
      </div>

      <div className="rounded-lg bg-dark-soft p-5">
        <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label="Binary search array diagram">
          {[2, 5, 8, 12, 17, 23].map((n, i) => {
            const x = 12 + i * 56;
            const isMid = i === 2;
            return (
              <g key={n}>
                <rect x={x} y={34} width={48} height={48} rx={6} fill={isMid ? '#FF7A00' : 'none'} stroke={isMid ? '#FF7A00' : '#A09D96'} strokeWidth="2" />
                <text x={x + 24} y={64} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="18" fill={isMid ? '#181715' : '#FAF9F5'}>
                  {n}
                </text>
              </g>
            );
          })}
          <text x={132} y={22} textAnchor="middle" fontFamily="Excalifont, cursive" fontSize="15" fill="#FF7A00">mid</text>
          <path d="M132 24 L132 32" stroke="#FF7A00" strokeWidth="2" />
          <text x={12} y={108} fontFamily="Excalifont, cursive" fontSize="13" fill="#A09D96">low</text>
          <text x={300} y={108} fontFamily="Excalifont, cursive" fontSize="13" fill="#A09D96">high</text>
        </svg>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-md bg-dark-elevated px-4 py-3 text-body-sm text-on-dark">
          “Why do we always check the middle first?”
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-end gap-1" aria-hidden>
            {[6, 12, 18, 10, 16, 8, 14].map((h, i) => (
              <span key={i} className="w-1 rounded-pill bg-brand" style={{ height: h }} />
            ))}
          </span>
          <span className="text-body-sm text-on-dark-soft">Great question — let's see what it rules out…</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sketch flow primitives (board visual) ─────────────────────────────── */
function FlowNode({ children, accent = false, tilt = 0 }: { children: ReactNode; accent?: boolean; tilt?: number }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-lg border px-4 py-2.5 font-sketch text-lg shadow-[0_2px_0_rgba(20,20,19,0.05)] ' +
        (accent ? 'border-brand/40 bg-brand/10 text-brand' : 'border-hairline bg-white text-ink')
      }
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  );
}
function FlowArrow({ accent = false }: { accent?: boolean }) {
  return <span className={'font-sketch text-2xl leading-none ' + (accent ? 'text-brand' : 'text-fg-soft')} aria-hidden>→</span>;
}

export function LandingPage() {
  const [topic, setTopic] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    const t = topic.trim();
    navigate(t ? `/session?topic=${encodeURIComponent(t)}` : '/session');
  };

  return (
    <div className="min-h-screen bg-canvas text-body">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-hairline bg-canvas">
        <div className="paper-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-32 -top-32 h-[440px] w-[440px] rounded-full bg-brand/10 blur-[120px]" />

        <div className="relative mx-auto flex min-h-[calc(100dvh-72px)] max-w-[1280px] items-center px-6 py-16 lg:px-10 lg:py-20">
          <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left */}
            <div className="flex flex-col items-start gap-6 text-left">
              <h1 className="animate-fade-up font-display text-[clamp(2.75rem,6.5vw,5rem)] font-normal leading-[1.04] tracking-[-0.03em] text-ink text-balance" style={{ animationDelay: '0.06s' }}>
                Learn anything.
                <span className="mt-3 block">
                  With an AI teacher<br className="hidden sm:block" /> that <span className="italic text-brand">actually</span> teaches.
                </span>
              </h1>

              <p className="animate-fade-up max-w-[600px] text-body-md leading-relaxed text-body sm:text-[18px]" style={{ animationDelay: '0.2s' }}>
                Ask any question and get a real lesson — with voice explanations, diagrams,
                examples, and step-by-step guidance.
              </p>

              {/* AI search box */}
              <div className="animate-fade-up w-full max-w-[600px]" style={{ animationDelay: '0.28s' }}>
                <div className="flex flex-col gap-2.5 rounded-2xl border border-hairline bg-white p-2.5 shadow-[0_8px_30px_rgba(20,20,19,0.07)] transition-all duration-300 focus-within:border-brand/60 focus-within:shadow-[0_12px_40px_rgba(255,122,0,0.14)] sm:flex-row sm:items-center">
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    placeholder="Teach me Binary Search from scratch..."
                    className="h-12 flex-1 rounded-xl bg-transparent px-3 text-body-md text-ink placeholder:text-fg-soft focus:outline-none"
                  />
                  <button
                    onClick={handleStart}
                    className="group inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[14px] bg-brand px-6 text-button text-white shadow-[0_4px_16px_rgba(255,122,0,0.3)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-active hover:shadow-[0_10px_28px_rgba(255,122,0,0.42)] active:translate-y-0"
                  >
                    Start Learning
                    <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right — the logo */}
            <div className="animate-fade-up flex justify-center lg:justify-end" style={{ animationDelay: '0.22s' }}>
              <div className="relative">
                <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[48px] bg-brand/15 blur-3xl" />
                <SharpenerGlyph className="animate-float h-auto w-[clamp(240px,34vw,460px)] text-brand" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────── */}
      <section className="bg-surface-soft px-6 lg:px-10 py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 text-center text-caption-uppercase uppercase text-brand">The problem</p>
          <h2 className="mb-4 text-center font-display text-display-md text-ink">Learning today is broken.</h2>
          <p className="mx-auto mb-16 max-w-body text-center text-body-md text-body">
            Every existing method shares the same fundamental flaw — it cannot adapt to you.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p) => (
              <div key={p.label} className="rounded-lg bg-surface-card p-8">
                <span className="mb-5 block h-3 w-3 rounded-sm bg-brand" />
                <h3 className="mb-2 text-title-md text-ink">{p.label}</h3>
                <p className="text-body-sm text-body">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how" className="px-6 lg:px-10 py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 text-center text-caption-uppercase uppercase text-brand">How it works</p>
          <h2 className="mb-4 text-center font-display text-display-md text-ink">A teacher that leads, listens, and adapts.</h2>
          <p className="mx-auto mb-16 max-w-body text-center text-body-md text-body">
            Not a chatbot. Not a course. A real-time AI teacher that drives the lesson.
          </p>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand/10 font-display text-title-lg text-brand">{i + 1}</div>
                <h3 className="text-title-lg text-ink">{step.title}</h3>
                <p className="text-body-md text-body">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Examples (dark mockup) ─────────────────────────────────────── */}
      <section id="examples" className="px-6 lg:px-10 py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 text-center text-caption-uppercase uppercase text-brand">See it in motion</p>
          <h2 className="mb-4 text-center font-display text-display-md text-ink">It draws, it speaks, you interrupt.</h2>
          <p className="mx-auto mb-12 max-w-body text-center text-body-md text-body">
            The lesson unfolds on a live whiteboard while the teacher talks — and stops the moment you have a question.
          </p>
          <div className="mx-auto max-w-[1100px]">
            <LessonMockup />
          </div>
        </div>
      </section>

      {/* ── The difference (board visual) ──────────────────────────────── */}
      <section id="why" className="bg-surface-soft px-6 lg:px-10 py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 text-center text-caption-uppercase uppercase text-brand">The difference</p>
          <h2 className="mb-4 text-center font-display text-display-md text-ink">Every other tool reacts. We lead.</h2>
          <p className="mx-auto mb-12 max-w-body text-center text-body-md text-body">
            Most tools answer a question and stop. shmora runs a loop — teaching, watching, and
            adapting until it actually lands.
          </p>

          {/* whiteboard panel */}
          <div className="whiteboard-grid rounded-xl border border-hairline bg-surface-card p-6 shadow-[0_1px_3px_rgba(20,20,19,0.06)] sm:p-10 lg:p-14">

            {/* Others lane */}
            <div>
              <p className="mb-6 font-sketch text-xl text-fg-muted">Others</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
                <FlowNode tilt={-1.5}>Question</FlowNode>
                <FlowArrow />
                <FlowNode tilt={1}>Answer</FlowNode>
                <span className="ml-2 font-sketch text-lg text-fg-soft">…and the conversation just stops.</span>
              </div>
            </div>

            {/* divider */}
            <div className="my-9 h-px w-full bg-hairline" />

            {/* shmora lane */}
            <div>
              <p className="mb-6 font-sketch text-xl text-brand">shmora</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
                <FlowNode accent tilt={-1}>Teach</FlowNode>
                <FlowArrow accent />
                <FlowNode accent tilt={1.5}>Observe</FlowNode>
                <FlowArrow accent />
                <FlowNode accent tilt={-1.5}>Adapt</FlowNode>
                <FlowArrow accent />
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand/40 bg-brand/10 px-3.5 py-2 font-sketch text-lg text-brand">
                  ↻ back to Teach
                </span>
                <span className="ml-2 font-sketch text-lg text-brand/80">…looping, adapting every single step.</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section id="start" className="px-6 lg:px-10 py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl bg-brand px-8 py-14 text-center lg:px-16 lg:py-16">
            <h2 className="font-display text-display-md text-white">Ready to learn differently?</h2>
            <p className="mx-auto mt-4 max-w-body text-body-md text-white/85 sm:text-[18px]">
              Start a lesson on any topic. Your AI teacher is waiting.
            </p>
            <Link
              to="/session"
              className="mt-10 inline-block rounded-[14px] bg-canvas px-8 py-3.5 text-button text-ink shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              Start a lesson →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-dark px-6 lg:px-10 py-16">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SharpenerGlyph size={28} className="text-brand" />
            <span className="font-sketch text-2xl text-on-dark">shmora</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#how" className="text-nav-link text-on-dark-soft transition-colors hover:text-on-dark">How it works</a>
            <a href="#why" className="text-nav-link text-on-dark-soft transition-colors hover:text-on-dark">Why it's different</a>
            <Link to="/session" className="text-nav-link text-on-dark-soft transition-colors hover:text-on-dark">Start</Link>
          </div>
          <p className="font-sketch text-lg text-on-dark-soft">Sharpen your ideas.</p>
        </div>
      </footer>

    </div>
  );
}
