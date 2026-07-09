import { useEffect, useRef } from 'react';
import type { Message } from '@shared/types';
import { stripSpeechMarks } from '../lib/speechMarks';

interface Props {
  messages: Message[];
}

export function TranscriptPanel({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      {messages.length === 0 && (
        <p className="text-body-sm text-fg-soft">Transcript will appear here.</p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={m.role === 'user' ? 'text-right' : 'text-left'}
        >
          <span
            className={
              'inline-block max-w-[85%] rounded-lg px-3 py-2 text-body-sm ' +
              (m.role === 'user'
                ? 'bg-brand text-white'
                : 'bg-surface-card text-body')
            }
          >
            {stripSpeechMarks(m.text)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
