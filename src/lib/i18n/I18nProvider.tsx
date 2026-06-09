"use client";
/**
 * I18nProvider — minimal, framework-agnostic i18n for the v1 English-only UI.
 *
 * - Loads message dictionaries by locale
 * - Exposes `useT()` returning a function that resolves dot-notation keys
 *   with `{var}` interpolation
 * - Exposes `useLocale()` and `useSetLocale()` for future language switching
 * - Flips `<html dir>` automatically when switching to an RTL locale
 *
 * Adding a new language: see config.ts.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ta from "@/messages/ta.json";
import ml from "@/messages/ml.json";
import { DEFAULT_LOCALE, RTL_LOCALES, isLocale, type Locale } from "./config";

/** localStorage key for the persisted user-selected locale. */
const LOCALE_STORAGE_KEY = "jamia.locale";

const messages = { en, ar, ta, ml } as const;

type MessageDict = (typeof messages)["en"];

type Vars = Record<string, string | number>;

export type TFunction = (key: string, vars?: Vars) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

function resolve(
  dict: MessageDict | undefined,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (
      cur &&
      typeof cur === "object" &&
      p in (cur as Record<string, unknown>)
    ) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name) => {
    const v = vars[name];
    return v === undefined || v === null ? `{${name}}` : String(v);
  });
}

export interface I18nProviderProps {
  children: ReactNode;
  /** Override the initial locale. Defaults to DEFAULT_LOCALE. */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale ?? DEFAULT_LOCALE,
  );

  // Hydrate from localStorage after mount. Doing this in a post-mount effect
  // (rather than in the useState initializer) keeps the server render and the
  // first client render identical, avoiding hydration warnings.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && isLocale(stored) && stored !== locale) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage may be unavailable (private mode, etc.) — ignore.
    }
    // We intentionally only run this on mount; later user changes are persisted
    // in setLocale below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect locale in <html lang/dir> so screen readers and CSS get the signal.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      }
    } catch {
      // localStorage may be unavailable — the in-memory locale still works.
    }
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => {
      const dict = messages[locale];
      const value = resolve(dict, key);
      // Missing keys fall back to the key itself so missing translations are visible.
      return interpolate(value ?? key, vars);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useSetLocale(): (next: Locale) => void {
  return useContext(I18nContext).setLocale;
}
