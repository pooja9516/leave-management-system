import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks loading/error/data.
 * Re-runs when `deps` change; stale responses are ignored and aborted.
 * The loader receives an AbortSignal.
 */
export function useFetch(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [reloadKey, setReloadKey] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, error: null, loading: true }));

    loaderRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, error, loading: false }));
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
