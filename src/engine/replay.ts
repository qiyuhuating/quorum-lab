import { validateAction, validateSeed } from './actions.ts';
import { MAX_ACTIONS, MAX_TIME, type ReplayDocument } from './types.ts';
import { Simulator } from './simulator.ts';

export function parseReplay(text: string): ReplayDocument {
  if (text.length > 2_000_000 || new TextEncoder().encode(text).byteLength > 2_000_000) {
    throw new Error('实验文件最多 2 MB。');
  }
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object') throw new Error('实验文件格式错误。');
  const doc = value as Record<string, unknown>;
  if (doc.version !== 1 || !Array.isArray(doc.actions) || doc.actions.length > MAX_ACTIONS)
    throw new Error('不支持的实验版本或操作数量。');
  const actions = doc.actions.map(validateAction);
  const elapsed = actions.reduce((sum, a) => sum + (a.type === 'advance' ? a.ms : 0), 0);
  if (elapsed > MAX_TIME) throw new Error('实验超过 120 秒虚拟时间。');
  return { version: 1, seed: validateSeed(doc.seed), actions };
}
export function replay(doc: ReplayDocument, cursor = doc.actions.length): Simulator {
  const validated = parseReplay(JSON.stringify(doc));
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > validated.actions.length)
    throw new Error('回放位置无效。');
  const sim = new Simulator(validated.seed);
  for (const a of validated.actions.slice(0, cursor)) sim.act(a);
  return sim;
}
