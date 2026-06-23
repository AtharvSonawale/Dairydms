import { useAppConfig } from '../context/AppConfigContext';

const TRANSLATIONS = {
    en: {
        dashboard: 'Dashboard', milkEntry: 'Milk Entry', settings: 'Settings',
        save: 'Save', cancel: 'Cancel', search: 'Search', loading: 'Loading…',
        // bills
        billTitle: 'Invoice', date: 'Date', total: 'Total', quantity: 'Quantity',
        rate: 'Rate', amount: 'Amount', seller: 'Seller',
    },
    mr: {
        dashboard: 'डॅशबोर्ड', milkEntry: 'दूध नोंद', settings: 'सेटिंग्ज',
        save: 'जतन करा', cancel: 'रद्द करा', search: 'शोधा', loading: 'लोड होत आहे…',
        billTitle: 'पावती', date: 'तारीख', total: 'एकूण', quantity: 'प्रमाण',
        rate: 'दर', amount: 'रक्कम', seller: 'विक्रेता',
    },
    hi: {
        dashboard: 'डैशबोर्ड', milkEntry: 'दूध एंट्री', settings: 'सेटिंग्स',
        save: 'सहेजें', cancel: 'रद्द करें', search: 'खोजें', loading: 'लोड हो रहा है…',
        billTitle: 'चालान', date: 'तारीख', total: 'कुल', quantity: 'मात्रा',
        rate: 'दर', amount: 'राशि', seller: 'विक्रेता',
    },
};

export function useTranslation() {
    const { language } = useAppConfig();
    const t = (key) => TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
    return { t, language };
}