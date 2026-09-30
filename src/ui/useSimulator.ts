import { useCallback, useEffect, useRef, useState } from 'react';
import type { Request, Response } from '../engine/bridge.ts';

export function useSimulator() {
  const worker = useRef<Worker | null>(null);
  const counter = useRef(0);
  const pending = useRef(
    new Map<number, { resolve: (r: Response) => void; reject: (e: Error) => void }>(),
  );
  const [state, setState] = useState<Response | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const w = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (event: MessageEvent<Response>) => {
      const response = event.data;
      setState(response);
      if (response.error) setError(response.error);
      const request = pending.current.get(response.id);
      pending.current.delete(response.id);
      if (response.error) request?.reject(new Error(response.error));
      else request?.resolve(response);
    };
    w.onerror = () => {
      setError('模拟器无法启动，请重新载入页面。');
      for (const p of pending.current.values()) p.reject(new Error('Worker failed'));
      pending.current.clear();
    };
    w.postMessage({ id: 0, type: 'init', seed: 7 });
    const requests = pending.current;
    return () => {
      w.terminate();
      worker.current = null;
      for (const p of requests.values()) p.reject(new Error('Simulator closed'));
      requests.clear();
    };
  }, []);
  const send = useCallback(
    (request: Request) =>
      new Promise<Response>((resolve, reject) => {
        if (!worker.current) {
          reject(new Error('模拟器尚未就绪。'));
          return;
        }
        const id = ++counter.current;
        pending.current.set(id, { resolve, reject });
        worker.current.postMessage({ ...request, id });
      }),
    [],
  );
  return { state, send, error, clearError: () => setError('') };
}
