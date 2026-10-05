import type { Action, ActionResult, ReplayDocument, Snapshot } from './types.ts';
import type { PartitionStory } from './story.ts';

export type Request =
  | { type: 'story'; chapter: number }
  | { type: 'echo' }
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
  story?: Omit<PartitionStory, 'document'>;
}
