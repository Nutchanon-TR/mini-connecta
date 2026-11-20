'use client';

import { useEffect, useRef, useState } from 'react';

export function useApiAction() {
  const current = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => () => {
    current.current?.abort();
    current.current = null;
  }, []);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (current.current) return;
    const controller = new AbortController();
    current.current = controller;
    setPending(true);
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (current.current === controller) {
        current.current = null;
        setPending(false);
      }
    }
  }

  return { pending, run };
}
