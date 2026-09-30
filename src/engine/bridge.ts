import type { Action, ActionResult, ReplayDocument, Snapshot } from './types.ts';

export type Request =
  | { type: 'init'; seed: number; starter?: boolean }
  | { type: 'act'; action: Action }
  | { type: 'seek'; cursor: number }
  | { type: 'load'; text: string }
  | { type: 'export' };
export interface Response {
  id: number;
  snapshot: Snapshot;
  historyLength: number;
  result?: ActionResult;
  document?: ReplayDocument;
  error?: string;
}
