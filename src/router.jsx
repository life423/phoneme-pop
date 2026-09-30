import { useEffect, useState } from 'react';

// A tiny history-based router: a handful of pages doesn't need a library.
const listeners = new Set();

export function navigate(to, { replace = false } = {}) {
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((listener) => listener());
  window.scrollTo(0, 0);
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

export function Link({ to, onClick, ...props }) {
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
      }}
      {...props}
    />
  );
}
