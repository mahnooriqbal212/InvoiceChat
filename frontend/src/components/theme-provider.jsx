import { createContext, useContext, useEffect, useState } from "react";

const ThemeProviderContext = createContext({
  theme: "system",
  setTheme: () => null,
});

// Some browsers (strict privacy settings, some in-app browsers) block storage and throw an error
// when we touch it. Without these try/catch blocks the whole app, even the client pay page, went blank.
function readTheme(storageKey, fallback) {
  try {
    return localStorage.getItem(storageKey) || fallback;
  } catch {
    return fallback;
  }
}

function saveTheme(storageKey, theme) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // The theme still changes for this visit; it just won't be remembered.
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "invoicechat-theme",
}) {
  const [theme, setThemeState] = useState(() => readTheme(storageKey, defaultTheme));

  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      root.classList.remove("light", "dark");
      if (theme === "system") {
        root.classList.add(media.matches ? "dark" : "light");
      } else {
        root.classList.add(theme);
      }
    };

    apply();

    // If the user chose "system", follow the computer when it changes
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (newTheme) => {
    saveTheme(storageKey, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
