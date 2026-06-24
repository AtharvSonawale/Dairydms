import { useAppConfig } from '../context/AppConfigContext';
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    Gift, ChevronDown, ChevronUp, RefreshCw, Printer,
    BadgeCheck, AlertTriangle, X, Users, Sparkles,
    CheckCircle2, Clock, Search, Banknote, Plus,
    Edit2, Check, Trash2, Settings, Calendar
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtQty = (n) => parseFloat(n || 0).toFixed(2);
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
const mm = (d) => String(d).padStart(2, "0");

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DEFAULT_SLABS = [
    { fat_min: 2.5, fat_max: 3.4, bonus: 0.00, vahatuk: 1.00, rate: 1.0 },
    { fat_min: 3.5, fat_max: 5.4, bonus: 0.50, vahatuk: 1.00, rate: 1.5 },
    { fat_min: 5.5, fat_max: 6.2, bonus: 1.00, vahatuk: 1.00, rate: 2.0 },
    { fat_min: 6.3, fat_max: 15.0, bonus: 1.50, vahatuk: 1.00, rate: 2.5 },
];

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────

export default function UtpadakBonusRegister() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();
    const { appName } = useAppConfig();

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(mm(now.getMonth() + 1));
    const [customFrom, setCustomFrom] = useState(
        `${now.getFullYear()}-${mm(now.getMonth() + 1)}-01`
    );
    const [customTo, setCustomTo] = useState(
        `${now.getFullYear()}-${mm(now.getMonth() + 1)}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
    );

    const fromDate = customFrom;
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const toDate = customTo;

    const [slabs, setSlabs] = useState(DEFAULT_SLABS);
    const [editingSlabs, setEditingSlabs] = useState(false);
    const [draftSlabs, setDraftSlabs] = useState(DEFAULT_SLABS);

    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [paying, setPaying] = useState(null);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterPaid, setFilterPaid] = useState("all");
    const [saving, setSaving] = useState(false);
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [showNewEventForm, setShowNewEventForm] = useState(false);
    const [undoingPaid, setUndoingPaid] = useState(null);
    const [deletingEvent, setDeletingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState(false);
    const [editEventDraft, setEditEventDraft] = useState(null);
    const [savingEvent, setSavingEvent] = useState(false);
    const [newEvent, setNewEvent] = useState({
        event_name: "",
        occasion: "diwali",
        from_date: fromDate,
        to_date: toDate,
    });
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const handleSaveRegister = async () => {
        if (saving || rows.length === 0) return;
        setSaving(true);
        try {
            await api.post("/bonus/save-register", {
                from_date: activeFrom,
                to_date: activeTo,
                sellers: rows.map(r => ({
                    seller_id: r.seller_id,
                    total_qty: r.totalQty,
                    total_amount: r.totalAmt,
                    buckets: slabs.map((s, i) => ({
                        fat_min: s.fat_min,
                        fat_max: s.fat_max,
                        rate: s.rate,
                        qty: r.buckets[i].qty,
                        amount: r.buckets[i].amt,
                    }))
                }))
            });
            showFlash("success", t('utpadakBonus.saveSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startBonusTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="bonus-header-actions"]',
                    popover: { title: t('utpadakBonus.bonusEvent'), description: 'Select an existing bonus event to view paid/unpaid status, or create a new one. Edit or delete events, and print the full register as a PDF.' },
                },
                {
                    element: '[data-tour="bonus-stats"]',
                    popover: { title: t('utpadakBonus.totalSellers'), description: 'Summary of total utpadak sellers, total milk quantity, total bonus amount to pay, and number of active fat slabs.' },
                },
                {
                    element: '[data-tour="bonus-progress"]',
                    popover: { title: t('utpadakBonus.paymentProgress'), description: 'Payment progress bar showing how many sellers have been marked as paid out of the total for the selected event.' },
                },
                {
                    element: '[data-tour="bonus-slabs"]',
                    popover: { title: t('utpadakBonus.slabConfig'), description: 'Configure FAT-based bonus slabs. Each slab defines the FAT% range and the bonus rate per litre. Click Edit Slabs to modify or add new slabs.' },
                },
                {
                    element: '[data-tour="bonus-search"]',
                    popover: { title: t('utpadakBonus.searchPlaceholder'), description: 'Search sellers by name or code, and filter by payment status — All, Unpaid, or Paid.' },
                },
                {
                    element: '[data-tour="bonus-sellers"]',
                    popover: { title: t('utpadakBonus.totalSellers'), description: 'Each card shows a seller\'s slab-wise breakdown. Click a card to expand the cow and buffalo fat-slab details. Use the Pay button (when an event is selected) to mark a seller as paid.' },
                },
            ],
        });
        driverObj.drive();
    };

    const fetchEvents = useCallback(async (forceSelectId = null) => {
        try {
            const { data } = await api.get("/bonus/events");
            setEvents(data);
            if (forceSelectId) {
                setSelectedEventId(forceSelectId);
            }
        } catch (err) {
            showFlash("error", t('utpadakBonus.eventLoadError'));
        }
    }, [t]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const handleCreateEvent = async () => {
        if (!newEvent.event_name || !newEvent.from_date || !newEvent.to_date) {
            showFlash("error", t('utpadakBonus.eventRequired'));
            return;
        }

        setCreatingEvent(true);
        try {
            const slabData = slabs.map((s, i) => ({
                fat_min: parseFloat(s.fat_min) || 0,
                fat_max: parseFloat(s.fat_max) || 0,
                bonus: parseFloat(s.bonus) || 0,
                vahatuk: parseFloat(s.vahatuk) || 1,
                rate: parseFloat(s.rate) || 0,
                sort_order: i + 1,
            }));

            const { data } = await api.post("/bonus/events", {
                ...newEvent,
                slabs: slabData,
            });

            const newEventId = data.event_id;
            showFlash("success", t('utpadakBonus.eventCreateSuccess'));
            setShowNewEventForm(false);
            setNewEvent({ event_name: "", occasion: "diwali", from_date: customFrom, to_date: customTo });
            await fetchEvents(newEventId);
        } catch (err) {
            console.error("Create event error:", err.response?.data);
            showFlash("error", err.response?.data?.message || t('utpadakBonus.eventCreateError'));
        } finally {
            setCreatingEvent(false);
        }
    };

    const selectedEvent = events.find(e => e.event_id === selectedEventId);
    const activeFrom = selectedEvent?.from_date?.split("T")[0] || fromDate;
    const activeTo = selectedEvent?.to_date?.split("T")[0] || toDate;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const queryFrom = selectedEvent ? activeFrom : fromDate;
            const queryTo = selectedEvent ? activeTo : toDate;

            const { data } = await api.get(
                `/payments/seller-summary?from=${queryFrom}&to=${queryTo}`
            );

            let sellersWithBonus = data;

            if (!selectedEvent) {
                sellersWithBonus = data.map(s => {
                    const entries = s.entries || [];
                    let bonusAmt = 0;
                    entries.forEach(e => {
                        const fat = parseFloat(e.fat || 0);
                        const qty = parseFloat(e.quantity || 0);
                        const slab = slabs.find(sl =>
                            fat >= parseFloat(sl.fat_min) && fat <= parseFloat(sl.fat_max)
                        );
                        if (slab) bonusAmt += qty * parseFloat(slab.rate);
                    });
                    return { ...s, bonus_amount: parseFloat(bonusAmt.toFixed(2)), is_paid: false, paid_at: null };
                });
            } else {
                const { data: paidStatus } = await api.get(
                    `/bonus/events/${selectedEventId}/paid-status`
                );
                const paidMap = Object.fromEntries(
                    paidStatus.map(p => [p.seller_id, p])
                );
                sellersWithBonus = data.map(s => ({
                    ...s,
                    is_paid: !!paidMap[s.seller_id],
                    paid_at: paidMap[s.seller_id]?.paid_at || null,
                }));
            }

            setSellers(sellersWithBonus);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.dataLoadError'));
        } finally {
            setLoading(false);
        }
    }, [activeFrom, activeTo, fromDate, toDate, selectedEvent, selectedEventId, slabs, t]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // compute per-seller slab buckets
    const computeRows = () =>
        sellers
            .filter(seller => (seller.seller_type || "").toLowerCase() === "utpadak")
            .map(seller => {
                const entries = seller.entries || [];
                const cowEntries = entries.filter(e => (e.milk_type || "cow").toLowerCase() === "cow");
                const buffaloEntries = entries.filter(e => (e.milk_type || "cow").toLowerCase() === "buffalo");

                const buckets = slabs.map(() => ({ qty: 0, amt: 0 }));
                entries.forEach(e => {
                    const fat = parseFloat(e.fat || 0);
                    const qty = parseFloat(e.quantity || 0);
                    const idx = slabs.findIndex(s => fat >= parseFloat(s.fat_min) && fat <= parseFloat(s.fat_max));
                    if (idx >= 0) {
                        buckets[idx].qty = parseFloat((buckets[idx].qty + qty).toFixed(2));
                        buckets[idx].amt = parseFloat((buckets[idx].amt + qty * parseFloat(slabs[idx].rate)).toFixed(2));
                    }
                });
                const totalQty = buckets.reduce((a, b) => a + b.qty, 0);
                const totalAmt = buckets.reduce((a, b) => a + b.amt, 0);

                const cowBuckets = slabs.map(() => ({ qty: 0, amt: 0 }));
                cowEntries.forEach(e => {
                    const fat = parseFloat(e.fat || 0);
                    const qty = parseFloat(e.quantity || 0);
                    const idx = slabs.findIndex(s => fat >= parseFloat(s.fat_min) && fat <= parseFloat(s.fat_max));
                    if (idx >= 0) {
                        cowBuckets[idx].qty = parseFloat((cowBuckets[idx].qty + qty).toFixed(2));
                        cowBuckets[idx].amt = parseFloat((cowBuckets[idx].amt + qty * parseFloat(slabs[idx].rate)).toFixed(2));
                    }
                });

                const buffaloBuckets = slabs.map(() => ({ qty: 0, amt: 0 }));
                buffaloEntries.forEach(e => {
                    const fat = parseFloat(e.fat || 0);
                    const qty = parseFloat(e.quantity || 0);
                    const idx = slabs.findIndex(s => fat >= parseFloat(s.fat_min) && fat <= parseFloat(s.fat_max));
                    if (idx >= 0) {
                        buffaloBuckets[idx].qty = parseFloat((buffaloBuckets[idx].qty + qty).toFixed(2));
                        buffaloBuckets[idx].amt = parseFloat((buffaloBuckets[idx].amt + qty * parseFloat(slabs[idx].rate)).toFixed(2));
                    }
                });

                const hasCow = cowEntries.length > 0;
                const hasBuffalo = buffaloEntries.length > 0;
                const milkTypeLabel = hasCow && hasBuffalo ? t('utpadakBonus.cowAndBuffalo') : hasCow ? t('utpadakBonus.cow') : t('utpadakBonus.buffalo');

                const finalAmt = selectedEvent
                    ? parseFloat(totalAmt.toFixed(2))
                    : parseFloat((seller.bonus_amount || totalAmt).toFixed(2));

                return {
                    ...seller,
                    buckets,
                    totalQty: parseFloat(totalQty.toFixed(2)),
                    totalAmt: finalAmt,
                    cowBuckets,
                    buffaloBuckets,
                    hasCow,
                    hasBuffalo,
                    milk_type: milkTypeLabel,
                };
            });
    const rows = computeRows();

    // mark paid
    const handleMarkPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (paying) return;
        setPaying(sellerId);
        try {
            await api.post(`/bonus/events/${selectedEventId}/mark-paid`, {
                seller_id: sellerId,
            });
            setSellers(prev =>
                prev.map(s => s.seller_id === sellerId ? { ...s, is_paid: true } : s)
            );
            showFlash("success", t('utpadakBonus.paidSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.paidError'));
        } finally {
            setPaying(null);
        }
    };

    const handleUndoPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (undoingPaid) return;
        setUndoingPaid(sellerId);
        try {
            await api.delete(`/bonus/events/${selectedEventId}/mark-paid/${sellerId}`);
            setSellers(prev =>
                prev.map(s => s.seller_id === sellerId ? { ...s, is_paid: false, paid_at: null } : s)
            );
            showFlash("success", t('utpadakBonus.undoSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.undoError'));
        } finally {
            setUndoingPaid(null);
        }
    };

    const handleDeleteEvent = async () => {
        if (!selectedEventId || deletingEvent) return;
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteEvent = async () => {
        setDeleteConfirmOpen(false);
        setDeletingEvent(true);
        try {
            await api.delete(`/bonus/events/${selectedEventId}`);
            showFlash("success", t('utpadakBonus.deleteEventSuccess'));
            setSelectedEventId(null);
            await fetchEvents();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.deleteEventError'));
        } finally {
            setDeletingEvent(false);
        }
    };

    const handleEditEvent = () => {
        if (!selectedEvent) return;
        setEditEventDraft({
            event_name: selectedEvent.event_name,
            occasion: selectedEvent.occasion,
            from_date: selectedEvent.from_date?.split("T")[0],
            to_date: selectedEvent.to_date?.split("T")[0],
        });
        setEditingEvent(true);
    };

    const handleSaveEditEvent = async () => {
        if (!editEventDraft || savingEvent) return;
        setSavingEvent(true);
        try {
            await api.put(`/bonus/events/${selectedEventId}`, editEventDraft);
            showFlash("success", t('utpadakBonus.eventUpdateSuccess'));
            setEditingEvent(false);
            await fetchEvents();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('utpadakBonus.eventUpdateError'));
        } finally {
            setSavingEvent(false);
        }
    };

    const toggleExpand = (id) =>
        setExpanded(p => ({ ...p, [id]: !p[id] }));

    // print register
    const handlePrint = () => {
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const pdfRows = filtered.flatMap(row => {
            const rowsArray = [];
            if (row.hasCow) {
                rowsArray.push({
                    ...row,
                    milk_type: t('utpadakBonus.cow'),
                    buckets: row.cowBuckets,
                    totalQty: row.cowBuckets.reduce((a, b) => a + b.qty, 0),
                    totalAmt: row.cowBuckets.reduce((a, b) => a + b.amt, 0),
                });
            }
            if (row.hasBuffalo) {
                rowsArray.push({
                    ...row,
                    milk_type: t('utpadakBonus.buffalo'),
                    buckets: row.buffaloBuckets,
                    totalQty: row.buffaloBuckets.reduce((a, b) => a + b.qty, 0),
                    totalAmt: row.buffaloBuckets.reduce((a, b) => a + b.amt, 0),
                });
            }
            return rowsArray;
        });

        const sellerMilkTypeCount = {};
        pdfRows.forEach(row => {
            sellerMilkTypeCount[row.seller_id] = (sellerMilkTypeCount[row.seller_id] || 0) + 1;
        });

        const slabHeaders = slabs.map(s => `
        <th style="padding:6px 8px;border:1px solid #ccc;text-align:center;font-size:10px;background:#1a1a1a;color:#fff;min-width:110px">
            <div>${t('utpadakBonus.fatRange', { min: s.fat_min, max: s.fat_max })}</div>
            <div style="font-weight:400;margin-top:2px">${t('utpadakBonus.bonus')}: ${parseFloat(s.bonus).toFixed(2)}</div>
            <div style="font-weight:400">${t('utpadakBonus.vahatuk')}: ${parseFloat(s.vahatuk).toFixed(2)}</div>
            <div style="font-weight:600">${t('utpadakBonus.rate')}: ${parseFloat(s.rate).toFixed(1)}</div>
        </th>
    `).join("");

        let groupIndex = -1;
        let lastSellerId = null;
        const dataRows = pdfRows.map((row, i) => {
            const slabCells = slabs.map((_, bi) => {
                const b = row.buckets[bi];
                return `
                <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:10px;${b.qty > 0 ? "" : "color:#bbb"}">
                    ${t('utpadakBonus.qty')} = ${b.qty > 0 ? parseFloat(b.qty).toFixed(0) : 0}<br/>
                    ${t('utpadakBonus.amt')} = ${b.amt > 0 ? parseFloat(b.amt).toFixed(0) : 0}
                </td>
            `;
            }).join("");

            const isNewSeller = lastSellerId !== row.seller_id;
            if (isNewSeller) {
                groupIndex++;
                lastSellerId = row.seller_id;
            }

            const milkTypeCount = sellerMilkTypeCount[row.seller_id];
            const nameCell = isNewSeller ?
                `<td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;font-weight:600"${milkTypeCount > 1 ? ` rowspan="${milkTypeCount}"` : ''}>${row.name}</td>` :
                '';

            const bgColor = groupIndex % 2 === 0 ? "#fff" : "#f9fafb";

            return `
            <tr style="background:${bgColor}">
                ${isNewSeller ? `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:10px"${milkTypeCount > 1 ? ` rowspan="${milkTypeCount}"` : ''}>${groupIndex + 1}</td>` : ''}
                ${nameCell}
                <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:10px;font-weight:600">${row.milk_type}</td>
                ${slabCells}
                <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:10px;font-weight:700;background:#f0f7ff">
                    ${t('utpadakBonus.qty')} = ${parseFloat(row.totalQty).toFixed(0)}<br/>
                    ${t('utpadakBonus.amt')} = <strong>${parseFloat(row.totalAmt).toFixed(0)}</strong>
                </td>
            </tr>
        `;
        }).join("");

        const grandSlabCells = slabs.map((_, bi) => {
            const colQty = pdfRows.reduce((a, r) => a + r.buckets[bi].qty, 0);
            const colAmt = pdfRows.reduce((a, r) => a + r.buckets[bi].amt, 0);
            return `
            <td style="padding:6px 8px;border:1px solid #999;text-align:center;font-size:10px;font-weight:700;background:#f0f0f0">
                ${t('utpadakBonus.qty')} = ${parseFloat(colQty).toFixed(0)}<br/>
                ${t('utpadakBonus.amt')} = ${parseFloat(colAmt).toFixed(0)}
            </td>
        `;
        }).join("");

        const grandTotalQty = pdfRows.reduce((a, r) => a + r.totalQty, 0);
        const grandTotalAmt = pdfRows.reduce((a, r) => a + r.totalAmt, 0);
        const totalSellers = filtered.length;
        const totalPdfRows = pdfRows.length;

        const monthName = MONTHS[parseInt(month) - 1] || "";

        win.document.write(`<!DOCTYPE html><html><head>
    <title>${t('utpadakBonus.pdfTitle')} - ${selectedEvent?.event_name || t('utpadakBonus.bonus')} - ${monthName} ${year}</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; }
        table { border-collapse: collapse; width: 100%; }
        @media print { @page { margin: 6mm; size: A4 portrait; } }
    </style>
    </head><body>

    <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:16px;font-weight:bold;letter-spacing:1px">${appName}</div>
        <div style="font-size:12px;color:#555;margin-top:3px">
            ${t('utpadakBonus.pdfSubtitle')} — ${selectedEvent?.event_name || t('utpadakBonus.bonus')} &nbsp;|&nbsp;
            ${monthName} ${year} &nbsp;|&nbsp;
            ${fmtDate(activeFrom)} ${t('utpadakBonus.to')} ${fmtDate(activeTo)}
        </div>
        <div style="font-size:10px;color:#888;margin-top:2px">
            ${t('utpadakBonus.pdfGenerated')}: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            &nbsp;·&nbsp; ${totalSellers} ${t('utpadakBonus.utpadakSellers')} (${totalPdfRows} ${t('utpadakBonus.entries')})
        </div>
    </div>

    <table style="border:1px solid #ccc">
        <thead>
            <tr>
                <th style="padding:6px 8px;border:1px solid #ccc;background:#1a1a1a;color:#fff;font-size:10px;text-align:center;min-width:32px">${t('utpadakBonus.no')}</th>
                <th style="padding:6px 8px;border:1px solid #ccc;background:#1a1a1a;color:#fff;font-size:10px;text-align:left;min-width:140px">${t('utpadakBonus.customerName')}</th>
                <th style="padding:6px 8px;border:1px solid #ccc;background:#1a1a1a;color:#fff;font-size:10px;text-align:center;min-width:80px">${t('utpadakBonus.milkType')}</th>
                ${slabHeaders}
                <th style="padding:6px 8px;border:1px solid #ccc;background:#0a3d8f;color:#fff;font-size:10px;text-align:center;min-width:100px">${t('utpadakBonus.total')}</th>
            </tr>
        </thead>
        <tbody>
            ${dataRows}
            <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #888">
                <td colspan="3" style="padding:6px 8px;border:1px solid #999;font-size:10px;font-weight:700">
                    ${t('utpadakBonus.grandTotal')} (${totalPdfRows} ${t('utpadakBonus.entries')} ${t('utpadakBonus.from')} ${totalSellers} ${t('utpadakBonus.sellers')})
                </td>
                ${grandSlabCells}
                <td style="padding:6px 8px;border:1px solid #999;text-align:center;font-size:10px;font-weight:700;background:#dbeafe">
                    ${t('utpadakBonus.qty')} = ${parseFloat(grandTotalQty).toFixed(0)}<br/>
                    ${t('utpadakBonus.amt')} = <strong>${parseFloat(grandTotalAmt).toFixed(0)}</strong>
                </td>
            </tr>
        </tbody>
    </table>

    <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:10px;color:#777">
        <span>${t('utpadakBonus.pdfFooter')}</span>
        <span>${t('utpadakBonus.pdfSignatory')}</span>
    </div>

    <script>window.onload = () => { window.print(); };</script>
    </body></html>`);
        win.document.close();
    };

    // slab editing
    const handleSlabChange = (idx, field, val) =>
        setDraftSlabs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: parseFloat(val) || 0 } : s));

    const handleSlabDelete = (idx) =>
        setDraftSlabs(prev => prev.filter((_, i) => i !== idx));

    const handleAddSlab = () =>
        setDraftSlabs(prev => [...prev, { fat_min: 0, fat_max: 0, bonus: 0, vahatuk: 1, rate: 1 }]);

    const handleSaveSlabs = () => {
        setSlabs(draftSlabs);
        setEditingSlabs(false);
        showFlash("success", t('utpadakBonus.slabUpdateSuccess'));
    };

    // filtered list
    const filtered = rows.filter(r => {
        const matchSearch =
            (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (r.seller_code || "").toLowerCase().includes(search.toLowerCase());
        const matchPaid =
            filterPaid === "all" ? true :
                filterPaid === "paid" ? r.is_paid : !r.is_paid;
        return matchSearch && matchPaid;
    });

    // totals
    const grandQty = rows.reduce((a, r) => a + r.totalQty, 0);
    const grandAmt = rows.reduce((a, r) => a + r.totalAmt, 0);
    const paidCount = rows.filter(r => r.is_paid).length;

    // Permission checks
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
    if (!can('utpadak_bonus_register', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-break { page-break-inside: avoid; }
                    body { background: white !important; }
                }
            `}</style>

            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Gift size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('utpadakBonus.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('utpadakBonus.pageSubtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="bonus-header-actions">
                        <button
                            onClick={startBonusTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition mt-4"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.bonusEvent')}</span>
                            <select
                                value={selectedEventId ?? "none"}
                                onChange={e => setSelectedEventId(e.target.value === "none" ? null : Number(e.target.value))}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition max-w-[200px]">
                                <option value="none">{t('utpadakBonus.noEvent')}</option>
                                {events.map(ev => (
                                    <option key={ev.event_id} value={ev.event_id}>
                                        {ev.event_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedEvent && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.period')}</span>
                                <span className="text-xs font-semibold text-gray-600 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    {fmtDate(activeFrom)} → {fmtDate(activeTo)}
                                </span>
                            </div>
                        )}

                        <button onClick={() => {
                            setNewEvent(p => ({ ...p, from_date: customFrom, to_date: customTo }));
                            setShowNewEventForm(v => !v);
                        }}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-amber-500 text-white hover:bg-amber-600 transition mt-4">
                            <Plus size={13} /> {t('utpadakBonus.newEvent')}
                        </button>

                        {selectedEvent && (
                            <>
                                <button onClick={handleEditEvent}
                                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                        bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition mt-4">
                                    <Edit2 size={13} /> {t('utpadakBonus.editEvent')}
                                </button>
                                <button onClick={handleDeleteEvent} disabled={deletingEvent}
                                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                        bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition mt-4">
                                    {deletingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    {t('utpadakBonus.deleteEvent')}
                                </button>
                            </>
                        )}

                        <button onClick={handlePrint}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-black text-white hover:bg-gray-800 transition mt-4">
                            <Printer size={13} /> {t('utpadakBonus.print')}
                        </button>
                    </div>
                </div>

                {showNewEventForm && (
                    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-6 py-5 flex flex-col gap-4 no-print">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-amber-500" />
                                <span className="text-sm font-semibold text-gray-700">{t('utpadakBonus.createEvent')}</span>
                            </div>
                            <button onClick={() => setShowNewEventForm(false)} className="text-gray-300 hover:text-gray-500">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.eventName')}</span>
                                <input value={newEvent.event_name}
                                    onChange={e => setNewEvent(p => ({ ...p, event_name: e.target.value }))}
                                    placeholder={t('utpadakBonus.eventNamePlaceholder')}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition w-44" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.occasion')}</span>
                                <select value={newEvent.occasion}
                                    onChange={e => setNewEvent(p => ({ ...p, occasion: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition">
                                    {["diwali", "holi", "eid", "custom"].map(o => (
                                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.fromDate')}</span>
                                <input type="date" value={newEvent.from_date}
                                    onChange={e => setNewEvent(p => ({ ...p, from_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.toDate')}</span>
                                <input type="date" value={newEvent.to_date}
                                    onChange={e => setNewEvent(p => ({ ...p, to_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <button onClick={handleCreateEvent} disabled={creatingEvent}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl
                                    bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition">
                                {creatingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                {t('utpadakBonus.createEventBtn')}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400">
                            {t('utpadakBonus.eventSlabNote', { count: slabs.length })}
                        </p>
                    </div>
                )}

                {/* Edit Event Form */}
                {editingEvent && editEventDraft && (
                    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm px-6 py-5 flex flex-col gap-4 no-print">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Edit2 size={14} className="text-blue-500" />
                                <span className="text-sm font-semibold text-gray-700">{t('utpadakBonus.editEventTitle')}</span>
                            </div>
                            <button onClick={() => setEditingEvent(false)} className="text-gray-300 hover:text-gray-500">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.eventName')}</span>
                                <input
                                    value={editEventDraft.event_name}
                                    onChange={e => setEditEventDraft(p => ({ ...p, event_name: e.target.value }))}
                                    placeholder={t('utpadakBonus.eventNamePlaceholder')}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition w-44"
                                />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.occasion')}</span>
                                <select
                                    value={editEventDraft.occasion}
                                    onChange={e => setEditEventDraft(p => ({ ...p, occasion: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition"
                                >
                                    {["diwali", "holi", "eid", "custom"].map(o => (
                                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.fromDate')}</span>
                                <input
                                    type="date"
                                    value={editEventDraft.from_date}
                                    onChange={e => setEditEventDraft(p => ({ ...p, from_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition"
                                />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.toDate')}</span>
                                <input
                                    type="date"
                                    value={editEventDraft.to_date}
                                    onChange={e => setEditEventDraft(p => ({ ...p, to_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition"
                                />
                            </div>
                            <button
                                onClick={handleSaveEditEvent}
                                disabled={savingEvent}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl
                                    bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                            >
                                {savingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                {t('utpadakBonus.saveChanges')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Date Range Controls */}
                <div className="flex items-center gap-3 flex-wrap no-print">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.from')}</span>
                        <input type="date" value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('utpadakBonus.to')}</span>
                        <input type="date" value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider opacity-0">{t('utpadakBonus.go')}</span>
                    </div>
                    {!selectedEvent && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium mt-4">
                            <Sparkles size={11} />
                            {t('utpadakBonus.noEventSelected')}
                        </div>
                    )}
                </div>

                {/* Print-only header */}
                <div className="hidden print:block mb-2">
                    <h2 className="text-xl font-bold">{t('utpadakBonus.pageTitle')}{selectedEvent ? ` — ${selectedEvent.event_name}` : ""}</h2>
                    <p className="text-sm text-gray-500">
                        {fmtDate(fromDate)} {t('utpadakBonus.to')} {fmtDate(toDate)}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-tour="bonus-stats">
                    <StatCard label={t('utpadakBonus.totalSellers')} value={rows.length}
                        icon={<Users size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label={t('utpadakBonus.totalQty')} value={`${fmtQty(grandQty)} L`}
                        icon={<Sparkles size={14} />}
                        color="text-amber-600 bg-amber-50 border-amber-100" />
                    <StatCard label={t('utpadakBonus.totalBonusAmt')} value={fmt(grandAmt)}
                        icon={<Banknote size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label={t('utpadakBonus.activeSlabs')} value={slabs.length}
                        sub={t('utpadakBonus.fatBased')}
                        icon={<Settings size={14} />}
                        color="text-violet-600 bg-violet-50 border-violet-100" />
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 no-print" data-tour="bonus-progress">
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                            <span>{t('utpadakBonus.paymentProgress')}</span>
                            <span className="text-gray-700 font-semibold">{paidCount} / {rows.length} {t('utpadakBonus.paid')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: rows.length ? `${(paidCount / rows.length) * 100}%` : "0%" }} />
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={13} />
                        {rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0}% {t('utpadakBonus.done')}
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Slab Config */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden no-print" data-tour="bonus-slabs">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Settings size={14} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700">{t('utpadakBonus.slabConfig')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
                                {slabs.length} {t('utpadakBonus.slabs')}
                            </span>
                        </div>
                        {!editingSlabs ? (
                            <button
                                onClick={() => { setDraftSlabs(slabs); setEditingSlabs(true); }}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                                    bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                                <Edit2 size={11} /> {t('utpadakBonus.editSlabs')}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button onClick={handleAddSlab}
                                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg
                                        bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                                    <Plus size={11} /> {t('utpadakBonus.addSlab')}
                                </button>
                                <button onClick={handleSaveSlabs}
                                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg
                                        bg-gray-900 text-white hover:bg-gray-700 transition">
                                    <Check size={11} /> {t('utpadakBonus.save')}
                                </button>
                                <button onClick={() => setEditingSlabs(false)}
                                    className="text-gray-400 hover:text-gray-600 transition">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {editingSlabs ? (
                        <div className="px-5 py-4 flex flex-col gap-2">
                            <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1"
                                style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 36px" }}>
                                <span>{t('utpadakBonus.fatMin')}</span><span>{t('utpadakBonus.fatMax')}</span>
                                <span>{t('utpadakBonus.bonusPerL')}</span><span>{t('utpadakBonus.vahatukPerL')}</span>
                                <span>{t('utpadakBonus.ratePerL')}</span><span />
                            </div>
                            {draftSlabs.map((slab, idx) => (
                                <div key={idx}
                                    className="grid gap-2 items-center py-2 border-b border-gray-100 last:border-b-0"
                                    style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 36px" }}>
                                    {["fat_min", "fat_max", "bonus", "vahatuk", "rate"].map(field => (
                                        <input key={field} type="number" step="0.1"
                                            value={slab[field]}
                                            onChange={e => handleSlabChange(idx, field, e.target.value)}
                                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    ))}
                                    <button onClick={() => handleSlabDelete(idx)}
                                        disabled={draftSlabs.length <= 1}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-400
                                            hover:bg-rose-50 disabled:opacity-30 transition">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap px-5 py-3">
                            {slabs.map((s, i) => (
                                <div key={i}
                                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                                    <span className="font-semibold text-gray-700">
                                        {t('utpadakBonus.fatRange', { min: s.fat_min, max: s.fat_max })}
                                    </span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-emerald-600 font-medium">{t('utpadakBonus.bonus')} {fmt(s.bonus)}</span>
                                    <span className="text-blue-500 font-medium">{t('utpadakBonus.vahatuk')} {fmt(s.vahatuk)}</span>
                                    <span className="font-bold text-gray-900">{t('utpadakBonus.rate')} {fmt(s.rate)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search + Filter */}
                <div className="flex items-center gap-2 no-print" data-tour="bonus-search">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('utpadakBonus.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[["all", t('utpadakBonus.all')], ["unpaid", t('utpadakBonus.unpaid')], ["paid", t('utpadakBonus.paid')]].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterPaid(v)}
                                className={`px-3 py-2 transition
                                    ${filterPaid === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Seller Cards */}
                <div className="flex flex-col gap-3" data-tour="bonus-sellers">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Gift size={32} />
                            <p className="text-sm">{t('utpadakBonus.noSellersFound')}</p>
                        </div>
                    ) : filtered.map(row => {
                        const isOpen = expanded[row.seller_id];
                        return (
                            <div key={row.seller_id}
                                className={`bg-white rounded-2xl border transition-all print-break
                                    ${row.is_paid ? "border-emerald-200" : "border-gray-200"}`}>

                                {/* Row */}
                                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                                    onClick={() => toggleExpand(row.seller_id)}>

                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                        ${row.is_paid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                                        {row.name?.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-800 truncate">
                                                {row.name} <span className="text-xs text-gray-400">({row.milk_type})</span>
                                            </p>
                                            {row.is_paid
                                                ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <CheckCircle2 size={9} /> {t('utpadakBonus.paid')}
                                                </span>
                                                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                    <Clock size={9} /> {t('utpadakBonus.pending')}
                                                </span>
                                            }
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{row.seller_code}</p>
                                    </div>

                                    {/* Desktop: slab amounts */}
                                    <div className="hidden sm:flex items-center gap-4 text-right mr-4">
                                        {row.buckets.map((b, bi) => (
                                            b.qty > 0 && (
                                                <div key={bi}>
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                                                        {t('utpadakBonus.fatRange', { min: slabs[bi].fat_min, max: slabs[bi].fat_max })}
                                                    </p>
                                                    <p className="text-xs font-semibold text-blue-600">{fmtQty(b.qty)} L</p>
                                                    <p className="text-xs font-semibold text-gray-700">{fmt(b.amt)}</p>
                                                </div>
                                            )
                                        ))}
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('utpadakBonus.totalBonus')}</p>
                                            <p className="text-base font-bold text-gray-900">{fmt(row.totalAmt)}</p>
                                        </div>
                                    </div>

                                    {!row.is_paid && selectedEventId ? (
                                        <button
                                            onClick={(e) => handleMarkPaid(e, row.seller_id)}
                                            disabled={paying === row.seller_id}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                                bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold
                                                transition disabled:opacity-50 shadow-sm shadow-emerald-200">
                                            {paying === row.seller_id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <CheckCircle2 size={11} />}
                                            {t('utpadakBonus.pay')} {fmt(row.totalAmt)}
                                        </button>
                                    ) : !row.is_paid && !selectedEventId ? (
                                        <span className="shrink-0 no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                            bg-gray-100 text-gray-400 text-xs font-semibold border border-gray-200">
                                            {t('utpadakBonus.selectEventToPay')}
                                        </span>
                                    ) : selectedEventId ? (
                                        <button
                                            onClick={(e) => handleUndoPaid(e, row.seller_id)}
                                            disabled={undoingPaid === row.seller_id}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                                bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold
                                                transition disabled:opacity-50 shadow-sm shadow-rose-200">
                                            {undoingPaid === row.seller_id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <X size={11} />}
                                            {t('utpadakBonus.undo')}
                                        </button>
                                    ) : null}

                                    <div className="shrink-0 text-gray-300">
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Mobile totals */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs">
                                    <span className="text-gray-400">{t('utpadakBonus.qty')}: <strong className="text-gray-700">{fmtQty(row.totalQty)} L</strong></span>
                                    <span className="font-bold text-gray-900">{t('utpadakBonus.bonus')}: {fmt(row.totalAmt)}</span>
                                </div>

                                {/* Expanded slab breakdown */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
                                        {/* Cow Breakdown */}
                                        {row.hasCow && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('utpadakBonus.cowFatSlab')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                        {[t('utpadakBonus.fatRange'), t('utpadakBonus.bonusPerL'), t('utpadakBonus.vahatukPerL'), t('utpadakBonus.ratePerL'), t('utpadakBonus.qtyL'), t('utpadakBonus.amount'), ""].map((h, i) => (
                                                            <div key={i} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    {slabs.map((s, bi) => {
                                                        const b = row.cowBuckets[bi];
                                                        return (
                                                            <div key={bi}
                                                                className={`grid border-b border-gray-50 last:border-b-0 transition
                                                                    ${b.qty > 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/40 opacity-50"}`}
                                                                style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                                <div className="px-3 py-2 text-xs font-semibold text-gray-700">{s.fat_min}–{s.fat_max}</div>
                                                                <div className="px-3 py-2 text-xs text-emerald-600 font-mono">{fmt(s.bonus)}</div>
                                                                <div className="px-3 py-2 text-xs text-blue-500 font-mono">{fmt(s.vahatuk)}</div>
                                                                <div className="px-3 py-2 text-xs text-amber-600 font-mono font-semibold">{fmt(s.rate)}</div>
                                                                <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{fmtQty(b.qty)} L</div>
                                                                <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(b.amt)}</div>
                                                                <div className="px-3 py-2" />
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="grid bg-gray-50 border-t border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-600 col-span-4">
                                                            {t('utpadakBonus.cowTotal')} ({slabs.filter((_, bi) => row.cowBuckets[bi].qty > 0).length} {t('utpadakBonus.slabs')})
                                                        </div>
                                                        <div className="px-3 py-2 text-xs font-bold text-blue-700">
                                                            {fmtQty(row.cowBuckets.reduce((a, b) => a + b.qty, 0))} L
                                                        </div>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-900">
                                                            {fmt(row.cowBuckets.reduce((a, b) => a + b.amt, 0))}
                                                        </div>
                                                        <div className="px-3 py-2" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Buffalo Breakdown */}
                                        {row.hasBuffalo && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('utpadakBonus.buffaloFatSlab')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                        {[t('utpadakBonus.fatRange'), t('utpadakBonus.bonusPerL'), t('utpadakBonus.vahatukPerL'), t('utpadakBonus.ratePerL'), t('utpadakBonus.qtyL'), t('utpadakBonus.amount'), ""].map((h, i) => (
                                                            <div key={i} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    {slabs.map((s, bi) => {
                                                        const b = row.buffaloBuckets[bi];
                                                        return (
                                                            <div key={bi}
                                                                className={`grid border-b border-gray-50 last:border-b-0 transition
                                                                    ${b.qty > 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/40 opacity-50"}`}
                                                                style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                                <div className="px-3 py-2 text-xs font-semibold text-gray-700">{s.fat_min}–{s.fat_max}</div>
                                                                <div className="px-3 py-2 text-xs text-emerald-600 font-mono">{fmt(s.bonus)}</div>
                                                                <div className="px-3 py-2 text-xs text-blue-500 font-mono">{fmt(s.vahatuk)}</div>
                                                                <div className="px-3 py-2 text-xs text-amber-600 font-mono font-semibold">{fmt(s.rate)}</div>
                                                                <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{fmtQty(b.qty)} L</div>
                                                                <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(b.amt)}</div>
                                                                <div className="px-3 py-2" />
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="grid bg-gray-50 border-t border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(4, 1fr) repeat(3, 1fr)" }}>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-600 col-span-4">
                                                            {t('utpadakBonus.buffaloTotal')} ({slabs.filter((_, bi) => row.buffaloBuckets[bi].qty > 0).length} {t('utpadakBonus.slabs')})
                                                        </div>
                                                        <div className="px-3 py-2 text-xs font-bold text-blue-700">
                                                            {fmtQty(row.buffaloBuckets.reduce((a, b) => a + b.qty, 0))} L
                                                        </div>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-900">
                                                            {fmt(row.buffaloBuckets.reduce((a, b) => a + b.amt, 0))}
                                                        </div>
                                                        <div className="px-3 py-2" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Final Summary */}
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>{t('utpadakBonus.totalMilkQty')}: <strong className="text-gray-800 ml-1">{fmtQty(row.totalQty)} L</strong></p>
                                            {row.hasCow && <p>{t('utpadakBonus.cow')}: <strong className="text-gray-800 ml-1">{fmtQty(row.cowBuckets.reduce((a, b) => a + b.qty, 0))} L</strong></p>}
                                            {row.hasBuffalo && <p>{t('utpadakBonus.buffalo')}: <strong className="text-gray-800 ml-1">{fmtQty(row.buffaloBuckets.reduce((a, b) => a + b.qty, 0))} L</strong></p>}
                                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 text-white mt-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider">{row.milk_type} {t('utpadakBonus.netBonus')}</span>
                                                <span className="text-base font-bold">{fmt(row.totalAmt)}</span>
                                            </div>
                                        </div>

                                        {row.is_paid && row.paid_at && (
                                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                                <CheckCircle2 size={13} />
                                                {t('utpadakBonus.bonusPaidOn')} {fmtDate(row.paid_at)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Grand Total Footer */}
                {filtered.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 overflow-x-auto">
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('utpadakBonus.totalSellers')}</p>
                                <p className="font-bold text-gray-800">{filtered.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-blue-400 uppercase tracking-wider">{t('utpadakBonus.totalQty')}</p>
                                <p className="font-bold text-blue-600">
                                    {fmtQty(filtered.reduce((a, r) => a + r.totalQty, 0))} L
                                </p>
                            </div>
                            {slabs.map((s, bi) => {
                                const colQty = filtered.reduce((a, r) => a + r.buckets[bi].qty, 0);
                                const colAmt = filtered.reduce((a, r) => a + r.buckets[bi].amt, 0);
                                if (colQty === 0) return null;
                                return (
                                    <div key={bi}>
                                        <p className="text-[10px] text-amber-400 uppercase tracking-wider">
                                            {t('utpadakBonus.fatRange', { min: s.fat_min, max: s.fat_max })}
                                        </p>
                                        <p className="font-bold text-amber-600">{fmt(colAmt)}</p>
                                        <p className="text-[10px] text-gray-400">{fmtQty(colQty)} L</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('utpadakBonus.totalBonusToPay')}</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {fmt(filtered.reduce((a, r) => a + r.totalAmt, 0))}
                            </p>
                        </div>
                    </div>
                )}

            </main>

            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">{t('utpadakBonus.deleteEvent')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('utpadakBonus.deleteEventWarning')}</p>
                                </div>
                            </div>
                            <button onClick={() => setDeleteConfirmOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">
                                {t('utpadakBonus.deleteEventConfirm', { name: selectedEvent?.event_name })}
                            </p>
                            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700 flex flex-col gap-1">
                                <p className="font-semibold">{t('utpadakBonus.willBeDeleted')}:</p>
                                <ul className="list-disc list-inside text-rose-600 mt-1 space-y-0.5">
                                    <li>{t('utpadakBonus.deleteSlabs')}</li>
                                    <li>{t('utpadakBonus.deletePayments')}</li>
                                    <li>{t('utpadakBonus.deleteEventRecord')}</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={() => setDeleteConfirmOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                {t('utpadakBonus.cancel')}
                            </button>
                            <button onClick={confirmDeleteEvent} disabled={deletingEvent}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {deletingEvent
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Trash2 size={12} />}
                                {deletingEvent ? t('utpadakBonus.deleting') : t('utpadakBonus.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}