import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';
export type CurrencyCode = 'BRL' | 'USD' | 'EUR';

export interface AppSettingsValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  formatCurrency: (value: number) => string;
}

export const AppSettingsContext = createContext<AppSettingsValue | null>(null);

export const useAppSettings = (): AppSettingsValue => {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within <AppSettingsProvider>');
  return ctx;
};
