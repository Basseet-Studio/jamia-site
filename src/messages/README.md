# Messages

Translation message dictionaries, one JSON file per locale.

## Files

- `en.json` — English source of truth. Add new keys here first.
- `ar.json` — Arabic (placeholder; replace English values with translations).
- `ta.json` — Tamil (placeholder; replace English values with translations).

## Conventions

- Keys are dot-notation namespaces, e.g. `dashboard.heading`, `expenses.addButton`.
- Interpolation uses `{varName}` placeholders, e.g. `"Delete {name}?"`.
- Missing keys fall back to the key string itself (visible in dev), so untranslated
  keys are obvious in Arabic/Tamil builds until you fill them in.

## Adding a new locale

1. Add the locale code to `src/lib/i18n/config.ts` (`LOCALES` + `RTL_LOCALES` if RTL).
2. Copy `en.json` to `<locale>.json` and translate.
3. Import the JSON in `src/lib/i18n/I18nProvider.tsx` and add it to the `messages` map.
4. (Optional) Build a language switcher using `useSetLocale()` from `@/lib/i18n`.

## Adding a new string

1. Add the key to `en.json` under an appropriate namespace (or create a new one).
2. Add the same key to `ar.json` and `ta.json` (placeholder is fine — it will
   still render and surface as "missing" in dev).
3. Use it in the component: `const t = useT(); … {t("namespace.key", { var })}`.
