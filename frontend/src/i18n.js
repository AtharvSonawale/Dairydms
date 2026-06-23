// src/i18n.js
// ─────────────────────────────────────────────────────────────
// react-i18next configuration
//
// Install once:
//   npm install i18next react-i18next
//
// This file is imported ONCE at the top of main.jsx (before <App />).
// After that, every component can use:
//   import { useTranslation } from 'react-i18next';
//   const { t } = useTranslation();
//   t('nav.dashboard')   →  "Dashboard" / "डॅशबोर्ड" / "डैशबोर्ड"
// ─────────────────────────────────────────────────────────────

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import mr from './locales/mr';
import hi from './locales/hi';

i18n
    .use(initReactI18next)
    .init({
        resources: { en, mr, hi },

        // Default language — AppConfigContext will call i18n.changeLanguage()
        // as soon as it fetches the saved preference from the backend.
        lng: 'en',

        // Fallback: if a key is missing in mr/hi, show English.
        fallbackLng: 'en',

        interpolation: {
            // React already escapes values — no need for i18next to do it.
            escapeValue: false,
        },

        // Disable suspense; we handle loading states ourselves.
        react: {
            useSuspense: false,
        },
    });

export default i18n;