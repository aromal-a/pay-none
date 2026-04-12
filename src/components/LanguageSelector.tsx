import { useI18n, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const LanguageSelector = () => {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground transition hover:bg-secondary/80"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        {LOCALE_NAMES[locale]}
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 z-50 max-h-64 w-44 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {(Object.keys(LOCALE_NAMES) as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`w-full px-3 py-2 text-start text-sm transition hover:bg-secondary ${
                l === locale ? "font-semibold text-primary" : "text-foreground"
              }`}
            >
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
