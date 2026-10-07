/** Languages posts can be written in. Order = tab order in the editor. */
export const LANGUAGES = [
  { code: "zh", name: "Chinese", native: "中文", flag: "🇨🇳", hint: "Simplified Chinese (简体中文)" },
  { code: "ko", name: "Korean", native: "한국어", flag: "🇰🇷", hint: "Korean" },
  { code: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵", hint: "Japanese" },
  { code: "ru", name: "Russian", native: "Русский", flag: "🇷🇺", hint: "Russian" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸", hint: "Spanish (neutral, for Spain and Latin America)" },
  { code: "pt", name: "Portuguese", native: "Português", flag: "🇧🇷", hint: "Brazilian Portuguese" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const LANG_CODES = LANGUAGES.map((l) => l.code) as LangCode[];

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && (LANG_CODES as string[]).includes(value);
}

export function langInfo(code: LangCode) {
  return LANGUAGES.find((l) => l.code === code)!;
}

/** Enabled languages in display order, never empty. */
export function enabledLangs(settings: { languages: string[] }): LangCode[] {
  const picked = LANG_CODES.filter((c) => settings.languages.includes(c));
  return picked.length ? picked : [...LANG_CODES];
}
