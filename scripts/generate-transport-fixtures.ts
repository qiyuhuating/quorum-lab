import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildVoteEcho } from '../src/engine/echo.ts';
import { Simulator } from '../src/engine/simulator.ts';
import { replay } from '../src/engine/replay.ts';

const echo = buildVoteEcho();
await writeFile('docs/experiments/vote-echo.json', JSON.stringify(echo.document, null, 2) + '\n');

const sim = new Simulator(7);
sim.act({ type: 'advance', ms: 1800 });
sim.act({ type: 'write', node: 'N1', key: 'order', value: 'first' });
let packet: number | undefined;
for (let i = 0; i < 100 && packet === undefined; i++) {
  sim.act({ type: 'step' });
  packet = sim
    .snapshot()
    .transport.pending.find(
      (p) => p.from === 'N2' && p.to === 'N1' && p.payload.kind === 'appended' && p.payload.success,
    )?.id;
}
assert.notEqual(packet, undefined);
sim.act({ type: 'hold', packet: packet! });
sim.act({ type: 'write', node: 'N1', key: 'order', value: 'second' });
sim.act({ type: 'advance', ms: 600 });
sim.act({ type: 'release', packet: packet!, delay: 1 });
sim.act({ type: 'advance', ms: 1 });
assert.equal(sim.snapshot().lastEffect?.decision.code, 'stale-rpc');
assert.deepEqual(
  sim.snapshot().lastEffect?.transition.before,
  sim.snapshot().lastEffect?.transition.after,
);
assert.deepEqual(replay(sim.export()).snapshot(), sim.snapshot());
await writeFile('docs/experiments/stale-ack.json', JSON.stringify(sim.export(), null, 2) + '\n');
console.log('Generated real vote-echo and delayed-acknowledgement action histories.');
