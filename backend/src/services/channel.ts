/**
 * A tiny async channel: push values in, consume them with `for await`.
 * close() ends iteration; close(err) makes the consumer's loop throw err.
 */

type Waiter<T> = {
  resolve: (r: IteratorResult<T>) => void;
  reject: (err: unknown) => void;
};

export class Channel<T> {
  private buffer: T[] = [];
  private waiters: Waiter<T>[] = [];
  private closed = false;
  private error: unknown = null;

  push(value: T): void {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w.resolve({ value, done: false });
    else this.buffer.push(value);
  }

  close(err?: unknown): void {
    if (this.closed) return;
    this.closed = true;
    this.error = err ?? null;
    for (const w of this.waiters.splice(0)) {
      if (this.error) w.reject(this.error);
      else w.resolve({ value: undefined as never, done: true });
    }
  }

  private next(): Promise<IteratorResult<T>> {
    if (this.buffer.length > 0) {
      return Promise.resolve({ value: this.buffer.shift() as T, done: false });
    }
    if (this.closed) {
      if (this.error) return Promise.reject(this.error);
      return Promise.resolve({ value: undefined as never, done: true });
    }
    return new Promise<IteratorResult<T>>((resolve, reject) =>
      this.waiters.push({ resolve, reject }),
    );
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return { next: () => this.next() };
  }
}
