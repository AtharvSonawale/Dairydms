// src/context/AppConfigContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const AppConfigContext = createContext({
    appName: 'MilkApp',
    logoUrl: '',
    language: 'en',
    textSize: 'base',
    fatOnlyAutofill: false,
    updateConfig: () => { },
    loaded: false,
});

export function AppConfigProvider({ children }) {
    const { user } = useAuth();
    const [appName, setAppName] = useState('MilkApp');
    const [logoUrl, setLogoUrl] = useState('');
    const [language, setLanguage] = useState('en');
    const [textSize, setTextSize] = useState('base');
    const [fatOnlyAutofill, setFatOnlyAutofill] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Apply the hard defaults (medium / English) immediately on boot, before
    // any network round-trip resolves, so there's never a flash of the
    // browser's native font size or i18n's own internal default language.
    useEffect(() => {
        applyFontSize('base');
        i18n.changeLanguage('en');
    }, []);

    // Re-fetch on mount AND whenever auth state changes (login/logout/role
    // switch) — settings can be dairy/centre-scoped server-side, so the
    // response before login (no token) can differ from the response after.
    // Without `user` as a dependency this only ever ran once at boot,
    // which is why settings looked stale until a hard browser refresh.
    useEffect(() => {
        // Dairy-wide branding + business rules
        api.get('/settings/global')
            .then(({ data }) => {
                if (data.app_name) setAppName(data.app_name);
                if (data.logo_url) setLogoUrl(data.logo_url);
                setFatOnlyAutofill(data.fat_only_autofill === '1' || data.fat_only_autofill === true);
            })
            .catch(() => { /* keep defaults */ });

        // Per-user (admin or operator) preferences — needs auth, so gate on `user`
        if (user) {
            api.get('/settings/app')
                .then(({ data }) => {
                    if (data.language) {
                        setLanguage(data.language);
                        i18n.changeLanguage(data.language);
                    }
                    if (data.text_size) {
                        setTextSize(data.text_size);
                        applyFontSize(data.text_size);
                    }
                })
                .catch(() => { /* keep defaults */ })
                .finally(() => setLoaded(true));
        } else {
            setLoaded(true);
        }
    }, [user?.id, user?.role]);

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
        if (patch.fatOnlyAutofill !== undefined) {
            setFatOnlyAutofill(patch.fatOnlyAutofill);
        }
    };

    return (
        <AppConfigContext.Provider value={{ appName, logoUrl, language, textSize, fatOnlyAutofill, updateConfig, loaded }}>
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