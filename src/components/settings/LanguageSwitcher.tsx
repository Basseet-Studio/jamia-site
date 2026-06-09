"use client";
/**
 * LanguageSwitcher — settings card exposing locale selection.
 *
 * Locale is stored in localStorage via I18nProvider.setLocale, so the choice
 * survives reloads. Switching also flips <html dir> automatically for RTL
 * locales (Arabic).
 */
import {
  LOCALES,
  LOCALE_LABELS,
  useLocale,
  useSetLocale,
  useT,
  type Locale,
} from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.language")}</CardTitle>
        <CardDescription>{t("settings.languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="locale-select">{t("settings.languageLabel")}</Label>
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            <SelectTrigger id="locale-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
