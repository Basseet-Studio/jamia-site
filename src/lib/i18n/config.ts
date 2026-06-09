/**
 * Locale configuration for the i18n system.
 *
 * To add a new language:
 *   1. Add the locale code to LOCALES below
 *   2. Add a native-script label to LOCALE_LABELS
 *   3. (If RTL) add the code to RTL_LOCALES
 *   4. Create src/messages/<locale>.json with the same shape as en.json
 *   5. Import it in I18nProvider.tsx and add it to the `messages` map
 */
export const LOCALES = ["en", "ar", "ta", "ml"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales written right-to-left. The Provider flips `<html dir>` on switch. */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

/**
 * Native-script labels for the language switcher.
 *
 * These are intentionally NOT in the message dictionaries: a language's own
 * name is conventionally shown in its own script regardless of the current UI
 * locale (e.g. "தமிழ்" stays "தமிழ்" even when the UI is in English).
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  ta: "தமிழ்",
  ml: "മലയാളം",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
