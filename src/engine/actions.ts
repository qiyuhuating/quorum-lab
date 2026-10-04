import { MAX_TIME, NODE_IDS, type Action } from './types.ts';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('实验操作必须是对象。');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error('实验参数超出允许范围。');
  }
  return value;
}
function node(value: unknown) {
  if (!NODE_IDS.includes(value as (typeof NODE_IDS)[number])) throw new Error('未知节点。');
  return value as (typeof NODE_IDS)[number];
}
export function validateSeed(value: unknown): number {
  return number(value, 0, 0xffffffff, true);
}
export function validateAction(value: unknown): Action {
  const a = object(value);
  switch (a.type) {
    case 'advance':
      return { type: a.type, ms: number(a.ms, 1, MAX_TIME, true) };
    case 'crash':
    case 'recover':
      return { type: a.type, node: node(a.node) };
    case 'heal':
    case 'step':
      return { type: a.type };
    case 'link': {
      const from = node(a.from),
        to = node(a.to);
      if (from === to || typeof a.enabled !== 'boolean')
        throw new Error('链路须连接两个不同节点，开关须为布尔值。');
      return { type: a.type, from, to, enabled: a.enabled };
    }
    case 'network':
      return {
        type: a.type,
        latency: number(a.latency, 10, 200, true),
        loss: number(a.loss, 0, 0.75),
      };
    case 'write': {
      if (
        typeof a.key !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_-]{0,23}$/.test(a.key) ||
        ['constructor', 'prototype', '__proto__'].includes(a.key)
      ) {
        throw new Error('键名需以字母开头，限 24 位字母、数字、下划线或短横线。');
      }
      if (typeof a.value !== 'string' || a.value.length > 80) throw new Error('值最多 80 个字符。');
      return { type: a.type, node: node(a.node), key: a.key, value: a.value };
    }
    case 'partition': {
      if (!Array.isArray(a.groups) || a.groups.length < 1 || a.groups.length > 5)
        throw new Error('分区列表无效。');
      const groups = a.groups.map((g) => {
        if (!Array.isArray(g) || g.length === 0) throw new Error('分区不能为空。');
        return g.map(node);
      });
      const ids = groups.flat();
      if (ids.length !== 5 || new Set(ids).size !== 5)
        throw new Error('分区须恰好包含全部五个节点。');
      return { type: a.type, groups };
    }
    default:
      throw new Error('未知实验操作。');
  }
}
