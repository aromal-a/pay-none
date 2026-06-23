## Plan: Add Multi-Language (i18n) Support

Based on the language codes listed (en, ar, bg, ca, cs, da, de, el, es, et, fi, fr, hr, id, it, ja, ko, ms, nl, no, pl, pt, ru, sk, sl, sr, sv, th, tr, uk, zh), this plan adds internationalization to the TokenStore app.

### What will be built

1. **Create translation system** (`src/lib/i18n.ts`)
   - A lightweight i18n utility with translations for all 31 listed languages
   - Covers key UI strings: "Buy Tokens", "Pay via UPI", "Continue", "Confirm", "Payment Confirmed", merchant labels, GST info, etc.
   - Language auto-detection from browser settings with manual override
   - RTL support for Arabic (ar)

2. **Create language selector component** (`src/components/LanguageSelector.tsx`)
   - Dropdown in the header to switch languages
   - Shows language name in its native script
   - Persists selection to `localStorage`

3. **Update all UI components to use translations**
   - `Index.tsx` — headings, descriptions, balance label
   - `UpiPaymentDialog.tsx` — all step labels, buttons, tax info, warnings
   - `TokenCard.tsx` , space,arduino,mux-s,sp-formative

4. **RTL layout support**
   - Add `dir="rtl"` to root when Arabic is selected
   - Ensure Tailwind styles work correctly in RTL mode
5. **Management of multi-layer**
   - Add token length
   - Window size
   - Million folds , open_size , size_defualt
6. **Contents Regulation**
   - Observe contents
   - Hold window size
   - Use wattpadd leterrings
   - Initial scale
   - Scale width

### Technical approach

- No external library — a simple React context + dictionary approach keeps the bundle small
- Translation keys organized by component/section
- Initial release with English fully translated; other languages with key UI strings (can be expanded)
- Expand dictionary if needed : otherwise (toggle)
