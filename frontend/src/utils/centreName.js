// src/utils/centreName.js
import api from "../api/axios";

const KEY = "centreName";

// Synchronous — used by renderReceiptHeader() where we can't await a
// network call.
export const getCentreName = () => {
    try {
        return localStorage.getItem(KEY) || "";
    } catch {
        return "";
    }
};

export const cacheCentreName = (name) => {
    try {
        localStorage.setItem(KEY, name || "");
    } catch { /* ignore */ }
};

// Pulls the logged-in user's centre name from /settings/system-info and
// refreshes the local cache. Called once on auth/user change from
// AppConfigContext so it's available everywhere without prop-drilling.
export const fetchCentreName = async () => {
    try {
        const { data } = await api.get("/settings/system-info");
        const name = data?.centre?.centre_name || "";
        cacheCentreName(name);
        return name;
    } catch {
        return getCentreName();
    }
};