import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

const PermissionContext = createContext({});

export function PermissionProvider({ children }) {
    const { user } = useAuth();
    const [perms, setPerms] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Decode operator id from JWT token if not directly on user object
        const getOpId = () => {
            if (user?.id) return user.id;
            if (user?.token) {
                try {
                    const payload = JSON.parse(atob(user.token.split('.')[1]));
                    return payload.id;
                } catch { return null; }
            }
            return null;
        };

        const opId = getOpId();
        if (!opId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        api.get(`/settings/permissions/${opId}`)
            .then(({ data }) => {
                console.log("Permissions received:", data);
                console.log("rate_chart in data:", data['rate_chart']);
                setPerms(data);
            })
            .catch((err) => {
                console.error("Perms fetch failed:", err.response?.data);
                setPerms({});
            })
            .finally(() => setLoading(false));
    }, [user?.id]);
    console.log("user object:", user);

    const can = (pageKey, op) => {
        if (user?.role === "admin") return true;
        if (loading) return true;
        const result = perms[pageKey]?.[op] ?? false;
        console.log(`can(${pageKey}, ${op}) = ${result}, perms[${pageKey}] =`, perms[pageKey]);
        return result;
    };

    return (
        <PermissionContext.Provider value={{ perms, can, loading }}>
            {children}
        </PermissionContext.Provider>
    );
}

export const usePermission = () => useContext(PermissionContext);