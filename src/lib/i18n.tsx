import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type Locale =
  | "en" | "ar" | "bg" | "ca" | "cs" | "da" | "de" | "el" | "es" | "et"
  | "fi" | "fr" | "hr" | "id" | "it" | "ja" | "ko" | "ms" | "nl" | "no"
  | "pl" | "pt" | "ru" | "sk" | "sl" | "sr" | "sv" | "th" | "tr" | "uk" | "zh";

export const RTL_LOCALES: Locale[] = ["ar"];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", ar: "العربية", bg: "Български", ca: "Català", cs: "Čeština",
  da: "Dansk", de: "Deutsch", el: "Ελληνικά", es: "Español", et: "Eesti",
  fi: "Suomi", fr: "Français", hr: "Hrvatski", id: "Bahasa Indonesia",
  it: "Italiano", ja: "日本語", ko: "한국어", ms: "Bahasa Melayu", nl: "Nederlands",
  no: "Norsk", pl: "Polski", pt: "Português", ru: "Русский", sk: "Slovenčina",
  sl: "Slovenščina", sr: "Српски", sv: "Svenska", th: "ไทย", tr: "Türkçe",
  uk: "Українська", zh: "中文",
};

type TranslationKeys = {
  buyTokens: string;
  heroDescription: string;
  tokens: string;
  balance: string;
  buyNow: string;
  mostPopular: string;
  bonusTokens: string;
  starter: string;
  popular: string;
  premium: string;
  payViaUpi: string;
  forTokens: string;
  continue_: string;
  back: string;
  confirm: string;
  reviewConfirm: string;
  merchant: string;
  payingVia: string;
  subtotal: string;
  total: string;
  gstLabel: string;
  gstNote: string;
  minAmountRequired: string;
  minAmountDesc: string;
  upiApp: string;
  phoneNumber: string;
  upiId: string;
  enterMobile: string;
  enterValidNumber: string;
  securedByUpi: string;
  sendingPayment: string;
  connectingTo: string;
  doNotClose: string;
  awaitingConfirmation: string;
  paymentSentWaiting: string;
  waitingForReceiver: string;
  paymentConfirmed: string;
  receiverConfirmed: string;
  transactionId: string;
  amount: string;
  tokensAdded: string;
  status: string;
  confirmed: string;
  done: string;
  pay: string;
};

const en: TranslationKeys = {
  buyTokens: "Buy Tokens",
  heroDescription: "Power up your account with tokens. Pay instantly via UPI.",
  tokens: "tokens",
  balance: "tokens",
  buyNow: "Buy Now",
  mostPopular: "Most Popular",
  bonusTokens: "+{0} bonus tokens!",
  starter: "Starter",
  popular: "Popular",
  premium: "Premium",
  payViaUpi: "Pay via UPI",
  forTokens: "For {0} tokens",
  continue_: "Continue",
  back: "Back",
  confirm: "Confirm",
  reviewConfirm: "Review & Confirm",
  merchant: "Merchant",
  payingVia: "Paying via",
  subtotal: "Subtotal",
  total: "Total",
  gstLabel: "GST (18%)",
  gstNote: "Amount includes applicable GST. Tokens are non-refundable once credited. By proceeding, you agree to the terms of service.",
  minAmountRequired: "Minimum ₹{0} required",
  minAmountDesc: "This amount is below the minimum payable threshold. Please select a higher package.",
  upiApp: "UPI App",
  phoneNumber: "Phone Number",
  upiId: "UPI ID",
  enterMobile: "Enter mobile number linked to UPI",
  enterValidNumber: "Enter a valid 10-digit number",
  securedByUpi: "Secured by UPI • 256-bit encryption",
  sendingPayment: "Sending Payment...",
  connectingTo: "Connecting to {0}",
  doNotClose: "Do not close this window",
  awaitingConfirmation: "Awaiting Confirmation",
  paymentSentWaiting: "Payment sent. Waiting for receiver to confirm the transaction.",
  waitingForReceiver: "Waiting for receiver...",
  paymentConfirmed: "Payment Confirmed!",
  receiverConfirmed: "Receiver has confirmed your payment",
  transactionId: "Transaction ID",
  amount: "Amount",
  tokensAdded: "Tokens Added",
  status: "Status",
  confirmed: "Confirmed",
  done: "Done",
  pay: "Pay ₹{0}",
};

// Helper to generate translations - in production these would be professionally translated
const t = (overrides: Partial<TranslationKeys>): TranslationKeys => ({ ...en, ...overrides });

const translations: Record<Locale, TranslationKeys> = {
  en,
  ar: t({ buyTokens: "شراء الرموز", heroDescription: "شحن حسابك بالرموز. ادفع فورًا عبر UPI.", tokens: "رموز", balance: "رموز", buyNow: "اشترِ الآن", mostPopular: "الأكثر شعبية", bonusTokens: "+{0} رموز إضافية!", starter: "مبتدئ", popular: "شائع", premium: "مميز", payViaUpi: "ادفع عبر UPI", continue_: "متابعة", back: "رجوع", confirm: "تأكيد", reviewConfirm: "مراجعة وتأكيد", done: "تم", paymentConfirmed: "!تم تأكيد الدفع" }),
  bg: t({ buyTokens: "Купете токени", continue_: "Продължи", back: "Назад", confirm: "Потвърди", done: "Готово", buyNow: "Купи сега", paymentConfirmed: "Плащането е потвърдено!" }),
  ca: t({ buyTokens: "Compra fitxes", continue_: "Continua", back: "Enrere", confirm: "Confirma", done: "Fet", buyNow: "Compra ara" }),
  cs: t({ buyTokens: "Koupit tokeny", continue_: "Pokračovat", back: "Zpět", confirm: "Potvrdit", done: "Hotovo", buyNow: "Koupit" }),
  da: t({ buyTokens: "Køb tokens", continue_: "Fortsæt", back: "Tilbage", confirm: "Bekræft", done: "Færdig", buyNow: "Køb nu" }),
  de: t({ buyTokens: "Tokens kaufen", heroDescription: "Laden Sie Ihr Konto mit Tokens auf. Zahlen Sie sofort per UPI.", continue_: "Weiter", back: "Zurück", confirm: "Bestätigen", done: "Fertig", buyNow: "Jetzt kaufen", paymentConfirmed: "Zahlung bestätigt!", mostPopular: "Beliebteste" }),
  el: t({ buyTokens: "Αγορά tokens", continue_: "Συνέχεια", back: "Πίσω", confirm: "Επιβεβαίωση", done: "Τέλος", buyNow: "Αγοράστε τώρα" }),
  es: t({ buyTokens: "Comprar tokens", heroDescription: "Recarga tu cuenta con tokens. Paga al instante con UPI.", continue_: "Continuar", back: "Atrás", confirm: "Confirmar", done: "Hecho", buyNow: "Comprar ahora", paymentConfirmed: "¡Pago confirmado!", mostPopular: "Más popular" }),
  et: t({ buyTokens: "Osta žetoone", continue_: "Jätka", back: "Tagasi", confirm: "Kinnita", done: "Valmis", buyNow: "Osta nüüd" }),
  fi: t({ buyTokens: "Osta tokeneita", continue_: "Jatka", back: "Takaisin", confirm: "Vahvista", done: "Valmis", buyNow: "Osta nyt" }),
  fr: t({ buyTokens: "Acheter des jetons", heroDescription: "Rechargez votre compte avec des jetons. Payez instantanément via UPI.", continue_: "Continuer", back: "Retour", confirm: "Confirmer", done: "Terminé", buyNow: "Acheter", paymentConfirmed: "Paiement confirmé!", mostPopular: "Le plus populaire" }),
  hr: t({ buyTokens: "Kupi tokene", continue_: "Nastavi", back: "Natrag", confirm: "Potvrdi", done: "Gotovo", buyNow: "Kupi sada" }),
  id: t({ buyTokens: "Beli Token", continue_: "Lanjut", back: "Kembali", confirm: "Konfirmasi", done: "Selesai", buyNow: "Beli sekarang" }),
  it: t({ buyTokens: "Acquista token", continue_: "Continua", back: "Indietro", confirm: "Conferma", done: "Fatto", buyNow: "Acquista ora", paymentConfirmed: "Pagamento confermato!" }),
  ja: t({ buyTokens: "トークンを購入", heroDescription: "トークンでアカウントをパワーアップ。UPIで即座に支払い。", continue_: "続ける", back: "戻る", confirm: "確認", done: "完了", buyNow: "今すぐ購入", paymentConfirmed: "支払い確認済み!", mostPopular: "人気" }),
  ko: t({ buyTokens: "토큰 구매", continue_: "계속", back: "뒤로", confirm: "확인", done: "완료", buyNow: "지금 구매", paymentConfirmed: "결제 확인됨!" }),
  ms: t({ buyTokens: "Beli Token", continue_: "Teruskan", back: "Kembali", confirm: "Sahkan", done: "Selesai", buyNow: "Beli sekarang" }),
  nl: t({ buyTokens: "Tokens kopen", continue_: "Doorgaan", back: "Terug", confirm: "Bevestigen", done: "Klaar", buyNow: "Nu kopen" }),
  no: t({ buyTokens: "Kjøp tokens", continue_: "Fortsett", back: "Tilbake", confirm: "Bekreft", done: "Ferdig", buyNow: "Kjøp nå" }),
  pl: t({ buyTokens: "Kup tokeny", continue_: "Kontynuuj", back: "Wstecz", confirm: "Potwierdź", done: "Gotowe", buyNow: "Kup teraz" }),
  pt: t({ buyTokens: "Comprar tokens", continue_: "Continuar", back: "Voltar", confirm: "Confirmar", done: "Feito", buyNow: "Comprar agora", paymentConfirmed: "Pagamento confirmado!" }),
  ru: t({ buyTokens: "Купить токены", heroDescription: "Пополните счёт токенами. Мгновенная оплата через UPI.", continue_: "Продолжить", back: "Назад", confirm: "Подтвердить", done: "Готово", buyNow: "Купить", paymentConfirmed: "Платёж подтверждён!", mostPopular: "Популярный" }),
  sk: t({ buyTokens: "Kúpiť tokeny", continue_: "Pokračovať", back: "Späť", confirm: "Potvrdiť", done: "Hotovo", buyNow: "Kúpiť" }),
  sl: t({ buyTokens: "Kupi žetone", continue_: "Nadaljuj", back: "Nazaj", confirm: "Potrdi", done: "Končano", buyNow: "Kupi zdaj" }),
  sr: t({ buyTokens: "Купи токене", continue_: "Настави", back: "Назад", confirm: "Потврди", done: "Готово", buyNow: "Купи сада" }),
  sv: t({ buyTokens: "Köp tokens", continue_: "Fortsätt", back: "Tillbaka", confirm: "Bekräfta", done: "Klar", buyNow: "Köp nu" }),
  th: t({ buyTokens: "ซื้อโทเคน", continue_: "ดำเนินต่อ", back: "กลับ", confirm: "ยืนยัน", done: "เสร็จ", buyNow: "ซื้อเลย" }),
  tr: t({ buyTokens: "Token satın al", continue_: "Devam", back: "Geri", confirm: "Onayla", done: "Tamam", buyNow: "Şimdi al", paymentConfirmed: "Ödeme onaylandı!" }),
  uk: t({ buyTokens: "Купити токени", continue_: "Продовжити", back: "Назад", confirm: "Підтвердити", done: "Готово", buyNow: "Купити", paymentConfirmed: "Платіж підтверджено!" }),
  zh: t({ buyTokens: "购买代币", heroDescription: "用代币为您的帐户充值。通过UPI即时付款。", continue_: "继续", back: "返回", confirm: "确认", done: "完成", buyNow: "立即购买", paymentConfirmed: "付款已确认!", mostPopular: "最受欢迎" }),
};

function detectLocale(): Locale {
  const stored = localStorage.getItem("app-locale") as Locale | null;
  if (stored && stored in translations) return stored;
  const browserLang = navigator.language.split("-")[0] as Locale;
  if (browserLang in translations) return browserLang;
  return "en";
}

export function interpolate(str: string, ...args: (string | number)[]): string {
  return args.reduce<string>((s, arg, i) => s.replace(`{${i}}`, String(arg)), str);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TranslationKeys;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  const isRtl = RTL_LOCALES.includes(locale);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem("app-locale", l);
    setLocaleState(l);
  }, []);

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale, isRtl]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale], isRtl }}>
      {children}
    </I18nContext.Provider>
  );
}

const fallback: I18nContextValue = {
  locale: "en",
  setLocale: () => {},
  t: translations.en,
  isRtl: false,
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  return ctx ?? fallback;
}
