import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    MoreHorizontal,
    ChevronDown,
    Settings2,
    X,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Pin,
    PinOff,
    RotateCcw,
    Check,
} from "lucide-react";
import api from "../api/axios";

const variantClasses = {
    dark: "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-gray-900/30",
    neutral: "bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80",
    blue: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30",
    emerald: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30",
    teal: "bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-teal-500/30",
    orange: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-500/30",
    violet: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/30",
    fuchsia: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white shadow-fuchsia-500/30",
    rose: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30",
    amber: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30",
};

// Merge the page's declared actions (source of truth for label/icon/onClick)
// with the user's saved pin/order preferences (source of truth for
// is_pinned/sort_order). An action the page stops declaring is simply
// dropped; a brand-new action falls back to its own defaultPinned.
function mergeActionsWithPrefs(actions, savedPrefs) {
    const prefMap = new Map(savedPrefs.map((p) => [p.action_key, p]));
    return actions.map((a, idx) => {
        const saved = prefMap.get(a.key);
        return {
            ...a,
            is_pinned: saved ? !!saved.is_pinned : a.defaultPinned !== false,
            sort_order: saved ? saved.sort_order : idx,
        };
    });
}

function sortByOrder(list) {
    return [...list].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Shareable, customizable header action bar.
 *
 * @param {string} pageKey        - unique key for this page, e.g. "rate_chart" (required to persist prefs)
 * @param {Array}  actions        - all available buttons: { key, label, icon, onClick, variant, disabled, loading, tourAttr, defaultPinned }
 * @param {string} moreLabel      - label for the overflow trigger (default "More")
 * @param {boolean} customizable  - whether to show the pin/reorder UI (default true)
 */
export default function ActionBar({
    pageKey,
    actions = [],
    moreLabel = "More",
    customizable = true,
}) {
    const [open, setOpen] = useState(false);
    const [customizing, setCustomizing] = useState(false);
    const [savedPrefs, setSavedPrefs] = useState([]); // raw prefs from API
    const [draft, setDraft] = useState([]); // working copy while customizing
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const ref = useRef(null);
    const customizeRef = useRef(null);

    // ── load saved prefs once per pageKey ──
    useEffect(() => {
        if (!pageKey) {
            setLoaded(true);
            return;
        }
        let cancelled = false;
        api
            .get(`/action-bar/${pageKey}`)
            .then(({ data }) => {
                if (!cancelled) setSavedPrefs(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setSavedPrefs([]);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });
        return () => {
            cancelled = true;
        };
    }, [pageKey]);

    const merged = useMemo(
        () => mergeActionsWithPrefs(actions, savedPrefs),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [actions, savedPrefs],
    );

    const pinned = useMemo(
        () => sortByOrder(merged.filter((a) => a.is_pinned)),
        [merged],
    );
    const unpinned = useMemo(
        () => sortByOrder(merged.filter((a) => !a.is_pinned)),
        [merged],
    );

    useEffect(() => {
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
            if (customizeRef.current && !customizeRef.current.contains(e.target))
                setCustomizing(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const openCustomize = () => {
        setDraft(sortByOrder(merged).map((a, idx) => ({ ...a, sort_order: idx })));
        setCustomizing(true);
        setOpen(false);
    };

    const togglePin = (key) => {
        setDraft((prev) =>
            prev.map((a) => (a.key === key ? { ...a, is_pinned: !a.is_pinned } : a)),
        );
    };

    const move = (key, direction) => {
        setDraft((prev) => {
            const list = sortByOrder(prev);
            const idx = list.findIndex((a) => a.key === key);
            const swapWith = idx + direction;
            if (idx === -1 || swapWith < 0 || swapWith >= list.length) return prev;
            const a = list[idx],
                b = list[swapWith];
            const aOrder = a.sort_order,
                bOrder = b.sort_order;
            return prev.map((item) => {
                if (item.key === a.key) return { ...item, sort_order: bOrder };
                if (item.key === b.key) return { ...item, sort_order: aOrder };
                return item;
            });
        });
    };

    const saveCustomization = async () => {
        if (!pageKey) {
            setCustomizing(false);
            return;
        }
        setSaving(true);
        try {
            const ordered = sortByOrder(draft).map((a, idx) => ({
                action_key: a.key,
                is_pinned: a.is_pinned,
                sort_order: idx,
            }));
            await api.put(`/action-bar/${pageKey}`, { actions: ordered });
            setSavedPrefs(ordered);
            setCustomizing(false);
        } catch {
            // keep the panel open so the user can retry / see it didn't save
        } finally {
            setSaving(false);
        }
    };

    const resetCustomization = async () => {
        setSaving(true);
        try {
            if (pageKey) await api.delete(`/action-bar/${pageKey}`);
            setSavedPrefs([]);
            setCustomizing(false);
        } catch {
            // no-op — leave current state as-is on failure
        } finally {
            setSaving(false);
        }
    };

    const renderButton = useCallback(
        (a) => (
            <button
                key={a.key}
                onClick={() => {
                    a.onClick?.();
                    setOpen(false);
                }}
                disabled={a.disabled}
                data-tour={a.tourAttr}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 disabled:opacity-50
        ${variantClasses[a.variant] || variantClasses.neutral}`}
            >
                {a.loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    a.icon && <a.icon size={15} />
                )}
                {a.label}
            </button>
        ),
        [],
    );

    if (!loaded) {
        // Avoid a flash of default (unmerged) order before prefs arrive.
        return <div className="h-[42px]" />;
    }

    return (
        <div className="flex items-end gap-2 flex-wrap relative" data-tour="action-buttons">
            {pinned.map(renderButton)}

            {unpinned.length > 0 && (
                <div className="relative" ref={ref}>
                    <button
                        onClick={() => setOpen((o) => !o)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                    >
                        <MoreHorizontal size={15} /> {moreLabel}
                        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>

                    {open && (
                        <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-2xl z-30 py-2 flex flex-col">
                            {unpinned.map((a) => (
                                <button
                                    key={a.key}
                                    onClick={() => {
                                        a.onClick?.();
                                        setOpen(false);
                                    }}
                                    disabled={a.disabled}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50/80 transition text-left disabled:opacity-40"
                                >
                                    {a.loading ? (
                                        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                                    ) : (
                                        a.icon && <a.icon size={15} className="shrink-0 text-gray-500" />
                                    )}
                                    {a.label}
                                </button>
                            ))}
                            {customizable && pageKey && (
                                <>
                                    <div className="my-1 border-t border-gray-200/60" />
                                    <button
                                        onClick={openCustomize}
                                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50/80 transition text-left"
                                    >
                                        <Settings2 size={15} className="shrink-0" />
                                        Customize actions
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* If everything is pinned there's no "More" button to hang the
          customize entry off, so give it its own small trigger. */}
            {customizable && pageKey && unpinned.length === 0 && (
                <button
                    onClick={openCustomize}
                    title="Customize actions"
                    className="flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-500 hover:bg-gray-50/80 transition shadow-sm"
                >
                    <Settings2 size={15} />
                </button>
            )}

            {customizing && (
                <div
                    ref={customizeRef}
                    className="absolute right-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-2xl z-40 flex flex-col"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60">
                        <p className="text-sm font-semibold text-gray-800">Customize actions</p>
                        <button
                            onClick={() => setCustomizing(false)}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition"
                        >
                            <X size={12} />
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto py-1">
                        {sortByOrder(draft).map((a, idx, arr) => (
                            <div
                                key={a.key}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50/60 transition"
                            >
                                <GripVertical size={13} className="text-gray-300 shrink-0" />
                                {a.icon && <a.icon size={14} className="text-gray-400 shrink-0" />}
                                <span className="flex-1 text-sm text-gray-700 truncate">{a.label}</span>

                                <button
                                    onClick={() => move(a.key, -1)}
                                    disabled={idx === 0}
                                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition"
                                    title="Move up"
                                >
                                    <ArrowUp size={12} />
                                </button>
                                <button
                                    onClick={() => move(a.key, 1)}
                                    disabled={idx === arr.length - 1}
                                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition"
                                    title="Move down"
                                >
                                    <ArrowDown size={12} />
                                </button>
                                <button
                                    onClick={() => togglePin(a.key)}
                                    className={`w-6 h-6 flex items-center justify-center rounded-md transition ${a.is_pinned
                                            ? "text-blue-600 hover:bg-blue-50"
                                            : "text-gray-300 hover:bg-gray-100"
                                        }`}
                                    title={a.is_pinned ? "Unpin (send to More)" : "Pin (always visible)"}
                                >
                                    {a.is_pinned ? <Pin size={12} /> : <PinOff size={12} />}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl">
                        <button
                            onClick={resetCustomization}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition disabled:opacity-50"
                        >
                            <RotateCcw size={11} /> Reset to default
                        </button>
                        <button
                            onClick={saveCustomization}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 transition disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Check size={12} />
                            )}
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}