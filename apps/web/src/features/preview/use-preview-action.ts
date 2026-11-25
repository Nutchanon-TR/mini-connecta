'use client';

import { useEffect, useRef, useState } from 'react';

export function usePreviewAction() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function start(delay: number, complete: () => void) {
    if (timer.current !== null) return;
    setPending(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPending(false);
      complete();
    }, delay);
  }

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setPending(false);
  }

  return { pending, start, cancel };
}
