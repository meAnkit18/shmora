import type { SessionState, Segment } from '../../shared/types.js';
import { planLesson, teachStep } from '../src/agents/teacherAgent.js';
import { SegmentExtractor, validateSegment } from '../src/ai/segmentParser.js';

const ALLOWED = new Set(['text', 'rectangle', 'circle', 'arrow', 'line']);

function checkSegment(seg: Segment): string[] {
  const problems: string[] = [];
  if (typeof seg.speech !== 'string' || !seg.speech) problems.push('missing speech');
  for (const d of seg.drawings) {
    if (!ALLOWED.has(d.type)) problems.push(`illegal draw type: ${d.type}`);
  }
  return problems;
}

async function main() {
  console.log('=== 1. planLesson("Binary Search") ===');
  const steps = await planLesson('Binary Search');
  console.log(steps);

  console.log('\n=== 2. teachStep (step 0), streaming segments ===');
  const state: SessionState = {
    sessionId: 'test',
    topic: 'Binary Search',
    steps,
    currentStep: 0,
    completedSteps: [],
    pendingSteps: steps.slice(1),
    paused: false,
    conversationHistory: [],
  };
  let count = 0;
  const issues: string[] = [];
  await teachStep(state, (seg) => {
    count++;
    const problems = checkSegment(seg);
    issues.push(...problems);
    console.log(
      `  segment ${count}: ${seg.drawings.length} drawing(s) [${seg.drawings
        .map((d) => d.type)
        .join(', ')}] | speech: "${seg.speech.slice(0, 70)}..."`,
    );
  });
  console.log(`  -> ${count} segment(s), ${issues.length} validation issue(s)`);

  console.log('\n=== 3. bad-JSON resilience (parser must not crash) ===');
  const emitted: Segment[] = [];
  const ex = new SegmentExtractor((s) => emitted.push(s));
  // malformed first object, valid second
  ex.push('[{"id":"a","drawings":[{"type":"text"');
  ex.push(',"x":"oops"}],"speech":"bad coords"},');
  ex.push('{"id":"b","drawings":[{"type":"banana","x":1,"y":1}],"speech":"hi"}]');
  ex.end();
  console.log(`  emitted ${emitted.length} segment(s); banana drawing dropped:`,
    JSON.stringify(emitted.map((s) => ({ id: s.id, draws: s.drawings.length, speech: s.speech }))));

  const direct = validateSegment({ type: 'x' }, 'z');
  console.log(`  validateSegment(garbage) -> ${direct === null ? 'null (ok)' : 'UNEXPECTED'}`);

  console.log('\nDONE.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
