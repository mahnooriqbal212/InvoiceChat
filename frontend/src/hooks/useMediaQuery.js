import { useSyncExternalStore } from "react";

// true while the screen matches the CSS media query, e.g. useMediaQuery("(min-width: 768px)")
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
