import { useState, useEffect } from 'react';
import en from '../locales/en.json';
import ru from '../locales/ru.json';
import es from '../locales/es.json';

const translations = { en, ru, es };

export type Language = 'en' | 'ru' | 'es';

export function useI18n() {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('preferred_language');
    if (saved === 'ru' || saved === 'es') {
      setLang(saved as Language);
    }
  }, []);

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('preferred_language', newLang);
  };

  return { lang, t, setLanguage };
}
