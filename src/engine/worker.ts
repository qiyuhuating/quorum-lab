import type { Request, Response } from './bridge.ts';
import { parseReplay, replay } from './replay.ts';
import { Simulator } from './simulator.ts';
import type { ReplayDocument } from './types.ts';

let sim = new Simulator();
let history: ReplayDocument | null = null;
self.onmessage = (event: MessageEvent<Request & { id: number }>) => {
  const request = event.data;
  let result: Response['result'];
  let document: ReplayDocument | undefined;
  let error: string | undefined;
  try {
    switch (request.type) {
      case 'init': {
        sim = new Simulator(request.seed);
        history = null;
        if (request.starter !== false) {
          sim.act({ type: 'advance', ms: 1800 });
          const leader = sim.snapshot().nodes.find((n) => n.role === 'leader');
          if (leader) {
            sim.act({ type: 'write', node: leader.id, key: 'mission', value: 'orbit' });
            sim.act({ type: 'advance', ms: 200 });
            sim.act({ type: 'write', node: leader.id, key: 'mode', value: 'nominal' });
            sim.act({ type: 'advance', ms: 200 });
          }
        }
        break;
      }
      case 'act':
        result = sim.act(request.action);
        history = null;
        break;
      case 'export':
        document = history ?? sim.export();
        break;
      case 'load': {
        const doc = parseReplay(request.text);
        const restored = replay(doc);
        sim = restored;
        history = doc;
        break;
      }
      case 'seek': {
        const doc = history ?? sim.export();
        const restored = replay(doc, request.cursor);
        history = doc;
        sim = restored;
        break;
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : '实验执行失败。';
  }
  const response: Response = {
    id: request.id,
    snapshot: sim.snapshot(),
    historyLength: history?.actions.length ?? sim.export().actions.length,
    result,
    document,
    error,
  };
  self.postMessage(response);
};
