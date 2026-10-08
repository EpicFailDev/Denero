const CURRENCY_LOCALE: Record<string, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'pt-PT',
};

const DEFAULT_CURRENCY = 'BRL';
const SETTINGS_KEY = 'organizai.settings';

function getActiveCurrency(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && CURRENCY_LOCALE[parsed.currency]) return parsed.currency;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_CURRENCY;
}

export const ONBOARDING_KEY = 'organizai_onboarding_complete';

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

let currencyFormatter: Intl.NumberFormat | null = null;
let formatterCurrency: string | null = null;

export function formatCurrency(value: number): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const currency = getActiveCurrency();
  if (!currencyFormatter || formatterCurrency !== currency) {
    currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      style: 'currency',
      currency,
    });
    formatterCurrency = currency;
  }
  return currencyFormatter.format(n);
}

/**
 * Converte uma data no formato `YYYY-MM-DD` para um `Date` LOCAL.
 * `new Date("2026-08-10")` interpreta como meia-noite UTC, o que desloca
 * o dia em -1 para fusos a oeste do meridiano (ex.: Brasil, UTC-3).
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d);
}

/** Normaliza valores numéricos (como "1.500,50", "1500,50", "1500.50", 1500) para number */
export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let str = String(value).trim();
  if (!str) return 0;

  // Remove símbolos monetários (R$), letras e espaços
  str = str.replace(/[R$\s]/gi, '');

  // Se contém tanto ponto quanto vírgula (ex: "1.500,50" ou "1,500.50")
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // pt-BR: "1.500,50" -> remove ponto, substitui vírgula por ponto -> "1500.50"
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // en-US: "1,500.50" -> remove vírgula -> "1500.50"
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: "1500,50" -> "1500.50"
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Apenas ponto: se tiver múltiplos pontos, ex: "1.000.000"
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
    }
  }

  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

