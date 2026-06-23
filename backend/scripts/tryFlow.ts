import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionState,
} from '../../shared/types.js';

const URL = 'http://localhost:3001';

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
    transports: ['websocket'],
  });

  let sessionId = '';
  let segCount = 0;

  socket.on('connect', () => console.log('[client] connected', socket.id));
  socket.on('error', (e) => console.log('[client] ERROR:', e.message));

  socket.on('session:created', (s: SessionState) => {
    sessionId = s.sessionId;
    console.log('\n[session:created] topic:', s.topic);
    console.log('  steps:', s.steps);
  });

  socket.on('lesson:segment', (seg) => {
    segCount++;
    console.log(
      `  [segment] draws=[${seg.drawings.map((d) => d.type).join(',')}] speech="${seg.speech.slice(0, 60)}..."`,
    );
  });

  socket.on('lesson:step_complete', ({ state }) => {
    console.log(
      `[step_complete] currentStep=${state.currentStep} completed=${JSON.stringify(state.completedSteps)} paused=${state.paused}`,
    );
  });

  socket.on('state:update', (s) => {
    console.log(
      `[state:update] step=${s.currentStep} paused=${s.paused} reason=${s.pausedReason ?? '-'} history=${s.conversationHistory.length}`,
    );
  });

  await new Promise<void>((res) => socket.on('connect', () => res()));

  console.log('\n>>> session:create "Binary Search"');
  socket.emit('session:create', { topic: 'Binary Search' });

  // wait for first step to finish (step_complete sets a flag via polling segCount stable)
  await waitForStepComplete();

  console.log('\n>>> user:interrupt "Why must the array be sorted?"');
  segCount = 0;
  socket.emit('user:interrupt', { sessionId, question: 'Why must the array be sorted?' });
  await waitForResume();

  console.log('\n>>> lesson:next');
  segCount = 0;
  socket.emit('lesson:next', { sessionId });
  await waitForStepComplete();

  console.log('\n>>> session:end');
  socket.emit('session:end', { sessionId });
  await wait(300);
  console.log('\nDONE.');
  socket.close();
  process.exit(0);

  // Resolves when the current step finishes streaming.
  function waitForStepComplete(): Promise<void> {
    return new Promise((res) => {
      const handler = () => {
        socket.off('lesson:step_complete', handler);
        res();
      };
      socket.on('lesson:step_complete', handler);
    });
  }

  // Resolves only after a genuine pause (paused=true) followed by resume (paused=false).
  function waitForResume(): Promise<void> {
    return new Promise((res) => {
      let sawPause = false;
      const handler = (s: SessionState) => {
        if (s.paused) sawPause = true;
        else if (sawPause) {
          socket.off('state:update', handler);
          res();
        }
      };
      socket.on('state:update', handler);
    });
  }
}

main().catch((e) => {
  console.error('FAILED', e);
  process.exit(1);
});
