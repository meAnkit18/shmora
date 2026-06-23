import { useState } from 'react';

interface Props {
  listening: boolean;
  speaking: boolean;
  paused: boolean;
  micSupported: boolean;
  volume: number;
  onToggleMic: () => void;
  onTogglePause: () => void;
  onVolumeChange: (v: number) => void;
  onAskText: (question: string) => void;
}

function IconMicOn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46l4.82 4.82L21 20.73 4.27 3z" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function VoiceControls({
  listening,
  speaking,
  paused,
  micSupported,
  volume,
  onToggleMic,
  onTogglePause,
  onVolumeChange,
  onAskText,
}: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    onAskText(q);
    setText('');
  };

  const muted = !listening;
  const status = speaking
    ? paused
      ? 'Paused'
      : 'Teacher is speaking…'
    : listening
    ? 'Listening — just speak to interrupt'
    : 'Ask a question or unmute to interrupt anytime';

  return (
    <div className="border-t border-hairline bg-canvas px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-hairline bg-white px-2.5 py-2 shadow-[0_4px_24px_rgba(20,20,19,0.06)] transition-all focus-within:border-brand/50 focus-within:shadow-[0_6px_28px_rgba(255,122,0,0.12)]">
        {/* Mic mute / unmute */}
        <button
          onClick={onToggleMic}
          disabled={!micSupported}
          title={
            !micSupported
              ? 'SpeechRecognition not supported in this browser'
              : muted
              ? 'Unmute microphone'
              : 'Mute microphone'
          }
          className={
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ' +
            (muted
              ? 'bg-surface-soft text-fg-muted hover:bg-surface-strong'
              : 'bg-brand text-white shadow-[0_2px_10px_rgba(255,122,0,0.35)] hover:bg-brand-active')
          }
        >
          {muted ? <IconMicOff /> : <IconMicOn />}
        </button>

        {/* Text interrupt input */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Type a question to interrupt…"
          className="h-10 flex-1 bg-transparent px-2 text-body-md text-ink placeholder:text-fg-soft focus:outline-none"
        />

        {/* Volume */}
        <div className="hidden items-center gap-2 px-1 text-fg-muted sm:flex">
          <IconVolume />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-20 accent-brand"
            title={`Volume ${Math.round(volume * 100)}%`}
          />
        </div>

        {/* Pause / resume teacher output */}
        <button
          onClick={onTogglePause}
          disabled={!speaking}
          title={paused ? 'Resume lesson' : 'Pause lesson'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-30"
        >
          {paused ? <IconPlay /> : <IconPause />}
        </button>

        {/* Send */}
        <button
          onClick={submit}
          disabled={!text.trim()}
          title="Ask"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_2px_10px_rgba(255,122,0,0.35)] transition-colors hover:bg-brand-active disabled:bg-brand-disabled disabled:text-white/70 disabled:shadow-none"
        >
          <IconSend />
        </button>
      </div>

      <p className="mt-2 text-center text-caption text-fg-soft">{status}</p>
    </div>
  );
}
