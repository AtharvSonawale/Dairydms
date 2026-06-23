// src/context/AppConfigContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';
import api from '../api/axios';

const AppConfigContext = createContext({
    appName: 'MilkApp',
    logoUrl: '',
    language: 'en',
    textSize: 'base',
    updateConfig: () => { },
    loaded: false,
});

export function AppConfigProvider({ children }) {
    const [appName, setAppName] = useState('MilkApp');
    const [logoUrl, setLogoUrl] = useState('');
    const [language, setLanguage] = useState('en');
    const [textSize, setTextSize] = useState('base');
    const [loaded, setLoaded] = useState(false);

    // Fetch once on mount
    useEffect(() => {
        api.get('/settings/global')
            .then(({ data }) => {
                if (data.app_name) setAppName(data.app_name);
                if (data.logo_url) setLogoUrl(data.logo_url);
                if (data.language) {
                    setLanguage(data.language);
                    i18n.changeLanguage(data.language);
                }
                if (data.text_size) {
                    setTextSize(data.text_size);
                    applyFontSize(data.text_size);
                }
            })
            .catch(() => { })
            .finally(() => setLoaded(true));
    }, []);

    // Sync title + favicon whenever appName or logoUrl changes
    useEffect(() => {
        document.title = appName;
        setFavicon(logoUrl);
    }, [appName, logoUrl]);

    const updateConfig = (patch = {}) => {
        if (patch.appName !== undefined) setAppName(patch.appName);
        if (patch.logoUrl !== undefined) setLogoUrl(patch.logoUrl);
        if (patch.language !== undefined) {
            setLanguage(patch.language);
            i18n.changeLanguage(patch.language);
        }
        if (patch.textSize !== undefined) {
            setTextSize(patch.textSize);
            applyFontSize(patch.textSize);
        }
    };

    return (
        <AppConfigContext.Provider value={{ appName, logoUrl, language, textSize, updateConfig, loaded }}>
            {children}
        </AppConfigContext.Provider>
    );
}

export const useAppConfig = () => useContext(AppConfigContext);

function applyFontSize(sz) {
    document.documentElement.style.fontSize =
        sz === 'sm' ? '13px' : sz === 'lg' ? '17px' : '15px';
}

function setFavicon(logoUrl) {
    // Remove ALL existing favicon links (both static and dynamic)
    document.querySelectorAll("link[rel~='icon']").forEach(el => el.remove());

    const link = document.createElement('link');
    link.id = 'dynamic-favicon';
    link.rel = 'icon';

    if (logoUrl) {
        link.href = logoUrl;
        link.type = logoUrl.startsWith('data:image/png') ? 'image/png'
            : logoUrl.startsWith('data:image/jpeg') || logoUrl.startsWith('data:image/jpg') ? 'image/jpeg'
                : logoUrl.startsWith('data:image/svg') ? 'image/svg+xml'
                    : 'image/x-icon';
    } else {
        link.href = '/favicon.svg';
        link.type = 'image/svg+xml';
    }

    document.head.appendChild(link);
}