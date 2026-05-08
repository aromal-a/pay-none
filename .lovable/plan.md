## Plan: Add Multi-Language (i18n) Support

Based on the language codes listed (en, ar, bg, ca, cs, da, de, el, es, et, fi, fr, hr, id, it, ja, ko, ms, nl, no, pl, pt, ru, sk, sl, sr, sv, th, tr, uk, zh), this plan adds internationalization to the TokenStore app.

### What will be built

1. **Create translation system** (`src/lib/i18n.tsx`)
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
   - `TokenCard.tsx` — tier names, bonus text, button labels
   - `Auth.tsx`, `Account.tsx`, `Chat.tsx`, `AdminCredit.tsx` — full coverage

4. **RTL layout support**
   - Add `dir="rtl"` to root when Arabic is selected
   - Ensure Tailwind styles work correctly in RTL mode

### Technical approach
- No external library — a simple React context + dictionary approach keeps the bundle small
- Translation keys organized by component/section
- Initial release with English fully translated; other languages with key UI strings (can be expanded)

---

## Plan: Full Translations Driven by User Location & Regional Language

Extend the existing i18n layer so the entire UI ships with **complete, professional-grade translations** and the app picks the right one based on the **visitor's geo-location and OS/browser language preference**.

### Goals

- Every visible string in the app — not just buttons — reads from the dictionary; no hardcoded English left in JSX.
- Out of the box, an Indian visitor on a Malayalam phone sees Malayalam; a Tamil-speaking user in Singapore sees Tamil; a French visitor in Quebec sees fr-CA, etc.
- User can always override; override persists in `localStorage` and is also stored on their `profiles` row when signed in (so it follows them across devices).

### Scope of languages

Keep the existing 31 European/Asian locales and **add Indian regional languages** (the highest-leverage gap given the UPI/Razorpay flow):
`hi` (Hindi), `bn` (Bengali), `ta` (Tamil), `te` (Telugu), `ml` (Malayalam), `kn` (Kannada), `mr` (Marathi), `gu` (Gujarati), `pa` (Punjabi), `or` (Odia), `as` (Assamese), `ur` (Urdu — RTL).

Add `ur` to `RTL_LOCALES` alongside `ar`.

### Translation completeness

Today most non-English locales only override a handful of keys and fall back to English via the `t({...})` helper. Replace that with **per-locale dictionaries that cover every key in `TranslationKeys`**.

Keys to add (currently missing) so every page is translatable:
- Auth: `signIn`, `signUp`, `email`, `password`, `phone`, `phonePlaceholder`, `phoneHelp`, `signInWithGoogle`, `noAccount`, `haveAccount`, `signOut`, `verifyEmailSent`, `invalidCredentials`.
- Account: `account`, `currentBalance`, `purchaseHistory`, `noPurchases`.
- Chat ("prompt"): `chat`, `channels`, `prompts`, `newPrompt`, `noPrompts`, `to`, `recipientEmail`, `writePrompt`, `charsLabel`, `balanceLabel`, `send`, `transferNote`, `insufficientTokens`, `recipientNotFound`, `cannotMessageSelf`, `messageEmpty`.
- Admin Credit: `adminCredit`, `customerEmail`, `razorpayPaymentId`, `tier`, `creditTokens`, `creditedSuccess`, `notAuthorized`, `paymentAlreadyCredited`.
- Errors / toasts: `walletNotFound`, `notAuthenticated`, `tryAgain`, `loading`, `success`, `error`, `cancel`.
- Channel display names: `ch_omiDonts`, `ch_camiOns`, `ch_camiOff`, `ch_broadcastHour`, `ch_bearableFashion`, `ch_wearableFashion`.

Each new locale file lives in `src/lib/translations/<code>.ts` exporting the full `TranslationKeys` object. `i18n.tsx` becomes a thin barrel that imports them. This keeps any one file under ~150 lines and lets translators work on one language without merge conflicts.

### Location-based detection

Detection order (first match wins):

1. Manual override in `localStorage` ("app-locale") — set via the language selector.
2. `profiles.preferred_locale` if the user is signed in.
3. **Geo-IP region → default language** lookup (see table below).
4. `navigator.languages` BCP-47 list, walking from most-preferred down (`ml-IN` → `ml`, `pt-BR` → `pt`).
5. Fallback: `en`.

Region-to-language defaults (only fires when the browser language is generic English / not in our supported set):

| Country | Default locale |
|---|---|
| IN — Kerala | ml |
| IN — Tamil Nadu / Puducherry | ta |
| IN — West Bengal / Tripura | bn |
| IN — Andhra Pradesh / Telangana | te |
| IN — Karnataka | kn |
| IN — Maharashtra / Goa | mr |
| IN — Gujarat / Daman & Diu | gu |
| IN — Punjab | pa |
| IN — Odisha | or |
| IN — Assam | as |
| IN (other / Delhi / UP / Bihar / MP / Rajasthan) | hi |
| PK | ur |
| SA, AE, EG, QA, KW, OM, BH, JO, IQ, LB, SY, MA, TN, DZ | ar |
| CN, HK, TW, SG | zh |
| JP | ja · KR | ko · TH | th · ID | id · MY | ms |
| DE, AT, CH | de · FR, BE, LU | fr · IT | it · ES | es · PT, BR | pt |
| NL | nl · DK | da · SE | sv · NO | no · FI | fi |
| RU, BY | ru · UA | uk · PL | pl · CZ | cs · SK | sk |
| HR, BA | hr · SI | sl · RS | sr · BG | bg · GR, CY | el · TR | tr · EE | et |
| Everywhere else | en |

### Geo source

Use a **free, no-key, edge-cached** geo lookup so we don't need a paid GeoIP plan:

- Primary: `https://ipapi.co/json/` (returns `country` + `region` codes). 30k requests/month free, no key.
- Fallback: `Intl.DateTimeFormat().resolvedOptions().timeZone` mapped to a coarse country (`Asia/Kolkata` → IN, etc.) — used when the network call fails or is blocked.

Result is cached for 7 days in `localStorage` (`geo-cache`) so we hit the network at most once a week per device.

### Cross-device persistence

- Add a nullable column **`profiles.preferred_locale text`**.
- When a signed-in user changes the language via the selector, write it to their profile row alongside `localStorage`.
- On sign-in, read it back and apply.

### Number / currency / date formatting

- Use `Intl.NumberFormat(locale, { style: "currency", currency: "INR" })` for amounts (already INR for our market).
- Use `Intl.DateTimeFormat(locale)` everywhere we currently call `.toLocaleString()` so dates render in the user's script and ordering.
- Pluralisation via `Intl.PluralRules` for the chat counter ("1 char" vs "2 chars" — and equivalents in languages with multiple plural forms like ru/pl/ar).

### Files to touch / add

- **add** `src/lib/translations/{en,hi,bn,ta,te,ml,kn,mr,gu,pa,or,as,ur,ar,…}.ts` — full dictionaries.
- **edit** `src/lib/i18n.tsx` — add Indian locales, add `ur` to RTL, swap `detectLocale` for the layered detector, expose `formatCurrency` / `formatDate` helpers.
- **add** `src/lib/geo.ts` — geo-IP fetch + 7-day cache + timezone fallback.
- **edit** `src/components/LanguageSelector.tsx` — group "Suggested for your region" at top, then alphabetical.
- **edit** every page (`Index`, `Auth`, `Account`, `Chat`, `AdminCredit`, `CheckoutReturn`, `NotFound`) and component (`TokenCard`, `RazorpayButton`, `StripeEmbeddedCheckout`, `PaymentTestModeBanner`) to read all visible strings from `useI18n().t`.
- **migration**: add `preferred_locale text` to `profiles`; user can update their own row (existing RLS already allows it).

### Acceptance

- Cold visitor in Kerala on a default English Android → app loads in Malayalam without any click.
- Same visitor switches to Tamil → choice persists across reloads, and after sign-in syncs to other devices.
- No string in the rendered UI is in English when a non-English locale is active (verified by a quick `rg "[A-Z][a-z]+ [A-Z][a-z]+"` over JSX).
- RTL applied correctly for `ar` and `ur`.
