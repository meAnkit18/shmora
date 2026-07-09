import { config } from '../config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** True if an error came from an aborted request (deliberate cancellation, not a failure). */
export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

interface StreamChatArgs {
  messages: ChatMessage[];
  onContentDelta: (delta: string) => void;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Streams a chat completion from the OpenAI-compatible endpoint.
 * IMPORTANT: this model emits `reasoning_content` deltas before `content` deltas.
 * We forward only `content`.
 * Aborting the signal cancels the request; the AbortError propagates to the caller.
 */
export async function streamChat({
  messages,
  onContentDelta,
  temperature = 0.4,
  maxTokens = 4000,
  signal,
}: StreamChatArgs): Promise<string> {
  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ai.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI stream request failed (${res.status}): ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;

      let chunk: unknown;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue; // ignore keep-alive / malformed SSE lines
      }
      const delta = (chunk as ChatChunk)?.choices?.[0]?.delta;
      const content = delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        full += content;
        onContentDelta(content);
      }
    }
  }

  return full;
}

/** Non-streamed completion (fallback lesson planning). Returns the full content string. */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: opts.temperature ?? 0.4,
      // Reasoning models can burn most of the budget before emitting content,
      // which previously starved planning (800 tokens) into silent failure.
      max_tokens: opts.maxTokens ?? 3000,
      messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as ChatChunk;
  return json.choices?.[0]?.message?.content ?? '';
}

interface ChatChunk {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string };
    message?: { content?: string };
  }>;
}
