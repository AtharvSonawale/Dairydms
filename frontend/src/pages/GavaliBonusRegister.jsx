import { useAppConfig } from '../context/AppConfigContext';
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    Gift, ChevronDown, ChevronUp, RefreshCw, Printer,
    BadgeCheck, AlertTriangle, X, Users, Sparkles,
    CheckCircle2, Clock, Search, Banknote, Plus,
    Edit2, Check, Trash2, Settings, Calendar, TrendingUp
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

// ── Default Slabs for Gavali: Cow and Buffalo only ────────────
const DEFAULT_SLABS = [
    { milk_type: "cow", bonus: 0.25, rate: 0.25 },
    { milk_type: "buffalo", bonus: 0.50, rate: 0.50 },
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
export default function GavaliBonusRegister() {
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
    const [newEvent, setNewEvent] = useState({
        event_name: "",
        occasion: "diwali",
        from_date: fromDate,
        to_date: toDate,
    });
    const [creatingEvent, setCreatingEvent] = useState(false);
    const [undoing, setUndoing] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState(false);
    const [editEventDraft, setEditEventDraft] = useState(null);
    const [savingEvent, setSavingEvent] = useState(false);

    const [lastYearData, setLastYearData] = useState({});
    const [currentYearData, setCurrentYearData] = useState({});

    // ── Flash Message ───────────────────────────────────────────
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };


    const startGavaliBonusTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="gavali-header-actions"]',
                    popover: { title: t('gavaliBonus.bonusEvent'), description: 'Select an existing bonus event or create a new one. Edit or delete events, and print the full register as an A3 PDF with monthly breakdown columns.' },
                },
                {
                    element: '[data-tour="gavali-stats"]',
                    popover: { title: t('gavaliBonus.totalSellers'), description: 'Summary of total gavali sellers, total milk quantity, total bonus amount to pay, and the current cow/buffalo bonus rates.' },
                },
                {
                    element: '[data-tour="gavali-progress"]',
                    popover: { title: t('gavaliBonus.paymentProgress'), description: 'Payment progress bar showing how many sellers have been marked as paid for the selected event.' },
                },
                {
                    element: '[data-tour="gavali-config"]',
                    popover: { title: t('gavaliBonus.bonusConfig'), description: 'Configure the bonus rate per litre for cow and buffalo milk separately. Click Edit Rates to update them.' },
                },
                {
                    element: '[data-tour="gavali-search"]',
                    popover: { title: t('gavaliBonus.searchPlaceholder'), description: 'Search sellers by name or code, and filter by payment status — All, Unpaid, or Paid.' },
                },
                {
                    element: '[data-tour="gavali-sellers"]',
                    popover: { title: t('gavaliBonus.totalSellers'), description: 'Each card shows a seller\'s cow and buffalo quantities, bonus amount, and year-over-year growth. Click to expand for a full breakdown. Use the Pay button (when an event is selected) to mark as paid.' },
                },
            ],
        });
        driverObj.drive();
    };

    // ── Fetch Events ────────────────────────────────────────────
    const fetchEvents = useCallback(async (forceSelectId = null) => {
        try {
            const { data } = await api.get("/gavali-bonus/events");
            setEvents(data);
            if (forceSelectId) {
                setSelectedEventId(forceSelectId);
            }
        } catch (err) {
            showFlash("error", t('gavaliBonus.eventLoadError'));
        }
    }, [t]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // ── Create Event ────────────────────────────────────────────
    const handleCreateEvent = async () => {
        if (!newEvent.event_name || !newEvent.from_date || !newEvent.to_date) {
            showFlash("error", t('gavaliBonus.eventRequired'));
            return;
        }
        setCreatingEvent(true);
        try {
            const { data } = await api.post("/gavali-bonus/events", {
                ...newEvent,
                cow_bonus: 0.25,
                buffalo_bonus: 0.50,
            });
            const newEventId = data.event_id;
            showFlash("success", t('gavaliBonus.eventCreateSuccess'));
            setShowNewEventForm(false);
            setNewEvent({ event_name: "", occasion: "diwali", from_date: customFrom, to_date: customTo });
            await fetchEvents(newEventId);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.eventCreateError'));
        } finally {
            setCreatingEvent(false);
        }
    };

    // ── Selected Event ─────────────────────────────────────────
    const selectedEvent = events.find(e => e.event_id === selectedEventId);
    const activeFrom = selectedEvent?.from_date?.split("T")[0] || fromDate;
    const activeTo = selectedEvent?.to_date?.split("T")[0] || toDate;

    // ── Fetch Last Year's Data for Growth Calculation ──────────
    const fetchLastYearData = useCallback(async () => {
        try {
            // Last year = current calendar year - 1, always full year 01/01 to 31/12
            const lastYear = new Date().getFullYear() - 1;
            const lastYearFromStr = `${lastYear}-01-01`;
            const lastYearToStr = `${lastYear}-12-31`;

            const response = await api.get(
                `/gavali-bonus/no-event-register?from=${lastYearFromStr}&to=${lastYearToStr}`
            );

            const lastYearMap = {};
            (response.data.sellers || []).forEach(seller => {
                lastYearMap[seller.seller_id] =
                    parseFloat(seller.cow_qty || 0) + parseFloat(seller.buffalo_qty || 0);
            });

            setLastYearData(lastYearMap);
        } catch (err) {
            console.error("Error fetching last year data:", err);
            setLastYearData({});
        }
    }, []);
    // ── Fetch Seller Data ───────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (selectedEventId) {
                const { data } = await api.get(
                    `/gavali-bonus/events/${selectedEventId}/register`
                );
                setSellers(data.sellers || []);
            } else {
                const { data } = await api.get(
                    `/gavali-bonus/no-event-register?from=${fromDate}&to=${toDate}`
                );
                setSellers(data.sellers || []);
            }

            // Fetch current full year qty (01/01/YY to 31/12/YY)
            const currentYear = new Date().getFullYear();
            const currentYearFromStr = `${currentYear}-01-01`;
            const currentYearToStr = `${currentYear}-12-31`;
            try {
                const { data: cyData } = await api.get(
                    `/gavali-bonus/no-event-register?from=${currentYearFromStr}&to=${currentYearToStr}`
                );
                const currentYearMap = {};
                (cyData.sellers || []).forEach(s => {
                    currentYearMap[s.seller_id] =
                        parseFloat(s.cow_qty || 0) + parseFloat(s.buffalo_qty || 0);
                });
                setCurrentYearData(currentYearMap);
            } catch (err) {
                console.error("Error fetching current year data:", err);
                setCurrentYearData({});
            }

            // Fetch last year's data after getting current sellers
            await fetchLastYearData();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.dataLoadError'));
        } finally {
            setLoading(false);
        }
    }, [selectedEventId, fromDate, toDate, fetchLastYearData, t]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Permission checks
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
    if (!can('gavali_bonus_register', 'R')) return <AccessDenied />;

    // ── Compute Rows with Growth Percentage ─────────────────────
    const computeRows = () =>
        sellers.map(seller => {
            const cow_qty = parseFloat(seller.cow_qty || 0);
            const buffalo_qty = parseFloat(seller.buffalo_qty || 0);
            const total_qty = cow_qty + buffalo_qty;

            // Current full year qty (01/01/YY to 31/12/YY)
            const currentYearQty = currentYearData[seller.seller_id] ?? total_qty;
            // Last full year qty (01/01/(YY-1) to 31/12/(YY-1))
            const lastYearQty = lastYearData[seller.seller_id] || 0;

            // Growth = (currentYear - lastYear) / lastYear * 100
            const percentage_increase = lastYearQty > 0
                ? Math.round(((currentYearQty - lastYearQty) / lastYearQty) * 100 * 10) / 10
                : currentYearQty > 0 ? 100 : 0;
            const cowRate = selectedEvent
                ? parseFloat(selectedEvent.cow_bonus || 0.25)
                : parseFloat(slabs.find(s => s.milk_type === "cow")?.bonus || 0.25);
            const buffaloRate = selectedEvent
                ? parseFloat(selectedEvent.buffalo_bonus || 0.50)
                : parseFloat(slabs.find(s => s.milk_type === "buffalo")?.bonus || 0.50);

            const total_bonus = selectedEvent
                ? parseFloat(seller.total_bonus || 0)
                : parseFloat(((cow_qty * cowRate) + (buffalo_qty * buffaloRate)).toFixed(2));

            return {
                ...seller,
                cow_qty,
                buffalo_qty,
                total_qty,
                total_bonus,
                percentage_increase,
                current_year_qty: currentYearQty,
                last_year_qty: lastYearQty,
                milk_type: (cow_qty > 0 && buffalo_qty > 0) ? t('gavaliBonus.cowAndBuffalo')
                    : cow_qty > 0 ? t('gavaliBonus.cow') : t('gavaliBonus.buffalo'),
                hasCow: cow_qty > 0,
                hasBuffalo: buffalo_qty > 0,
            };
        });
    const rows = computeRows();

    // ── Mark Paid ──────────────────────────────────────────────
    const handleMarkPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (paying) return;
        setPaying(sellerId);
        try {
            await api.post(`/gavali-bonus/events/${selectedEventId}/mark-paid`, {
                seller_id: sellerId,
            });
            setSellers(prev =>
                prev.map(s => s.seller_id === sellerId ? { ...s, is_paid: true, paid_at: new Date().toISOString() } : s)
            );
            showFlash("success", t('gavaliBonus.paidSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.paidError'));
        } finally {
            setPaying(null);
        }
    };

    const handleUndoPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (undoing) return;
        setUndoing(sellerId);
        try {
            await api.post(`/gavali-bonus/events/${selectedEventId}/undo-paid`, {
                seller_id: sellerId,
            });
            setSellers(prev =>
                prev.map(s => s.seller_id === sellerId ? { ...s, is_paid: false, paid_at: null } : s)
            );
            showFlash("success", t('gavaliBonus.undoSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.undoError'));
        } finally {
            setUndoing(null);
        }
    };

    // ── Delete Event ───────────────────────────────────────────
    const handleDeleteEvent = () => {
        if (!selectedEventId || deletingEvent) return;
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteEvent = async () => {
        setDeleteConfirmOpen(false);
        setDeletingEvent(true);
        try {
            await api.delete(`/gavali-bonus/events/${selectedEventId}`);
            showFlash("success", t('gavaliBonus.deleteEventSuccess'));
            setSelectedEventId(null);
            await fetchEvents();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.deleteEventError'));
        } finally {
            setDeletingEvent(false);
        }
    };

    // ── Edit Event ─────────────────────────────────────────────
    const handleEditEvent = () => {
        if (!selectedEvent) return;
        setEditEventDraft({
            event_name: selectedEvent.event_name,
            occasion: selectedEvent.occasion,
            from_date: selectedEvent.from_date?.split("T")[0],
            to_date: selectedEvent.to_date?.split("T")[0],
            cow_bonus: selectedEvent.cow_bonus,
            buffalo_bonus: selectedEvent.buffalo_bonus,
        });
        setEditingEvent(true);
    };

    const handleSaveEditEvent = async () => {
        if (!editEventDraft || savingEvent) return;
        setSavingEvent(true);
        try {
            await api.put(`/gavali-bonus/events/${selectedEventId}`, editEventDraft);
            showFlash("success", t('gavaliBonus.eventUpdateSuccess'));
            setEditingEvent(false);
            await fetchEvents();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('gavaliBonus.eventUpdateError'));
        } finally {
            setSavingEvent(false);
        }
    };

    // ── Toggle Expand ──────────────────────────────────────────
    const toggleExpand = (id) =>
        setExpanded(p => ({ ...p, [id]: !p[id] }));

    // ── Print Register ──────────────────────────────────────────
    const handlePrint = async () => {
        const win = window.open("", "_blank", "width=1400,height=900");
        if (!win) return;

        const cowBonus = selectedEvent?.cow_bonus
            || slabs.find(s => s.milk_type === "cow")?.bonus
            || 0.25;
        const buffaloBonus = selectedEvent?.buffalo_bonus
            || slabs.find(s => s.milk_type === "buffalo")?.bonus
            || 0.50;

        // ── Fetch real per-month breakdown ──────────────────────
        let monthlyBreakdown = {}; // { [seller_id]: { "YYYY-MM": { cow_qty, buffalo_qty } } }
        try {
            const { data } = await api.get(
                `/gavali-bonus/monthly-breakdown?from=${activeFrom}&to=${activeTo}`
            );
            monthlyBreakdown = data.breakdown || {};
        } catch (err) {
            console.error("Failed to fetch monthly breakdown:", err);
            // falls back to even distribution below
        }

        // ── Build dynamic month columns from activeFrom → activeTo ──
        const rangeStart = new Date(activeFrom);
        const rangeEnd = new Date(activeTo);

        const monthsInRange = [];
        const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        while (cur <= rangeEnd) {
            const yyyy = cur.getFullYear();
            const mm = String(cur.getMonth() + 1).padStart(2, "0");
            monthsInRange.push({ year: yyyy, month: cur.getMonth(), key: `${yyyy}-${mm}` });
            cur.setMonth(cur.getMonth() + 1);
        }

        const totalMonths = monthsInRange.length;
        const halfLen = Math.ceil(totalMonths / 2);
        const topMonths = monthsInRange.slice(0, halfLen);
        const bottomMonths = monthsInRange.slice(halfLen);
        const pairedCols = topMonths.map((top, i) => ({ top, bottom: bottomMonths[i] || null }));

        const MON_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // ── Helper: get real monthly qty — coerce seller_id to string to match backend ──
        // ── Helper: get real monthly qty ────────────────────────────
        const getMonthQty = (sellerId, monthKey, milkType, totalQty) => {
            const sid = String(sellerId);
            const sellerData = monthlyBreakdown[sid];

            if (sellerData) {
                // Seller found in breakdown — use real data, 0 if no entries that month
                return sellerData[monthKey]
                    ? parseFloat(sellerData[monthKey][milkType] || 0)
                    : 0;
            }

            // Seller not in breakdown (no milk entries at all in range) → even fallback
            return totalMonths > 0 ? totalQty / totalMonths : 0;
        };
        
        
        // ── Build data rows ─────────────────────────────────────
        let brnCounter = 0;
        let lastSellerName = null;

        const dataRows = filtered.flatMap((row, idx) => {
            const isNewSeller = lastSellerName !== row.name;
            if (isNewSeller) { brnCounter++; lastSellerName = row.name; }
            const brn = brnCounter;
            const mem = row.seller_code || (idx + 1);

            const milkTypes = [];
            if (row.hasCow) milkTypes.push({ type: "COW", milkKey: "cow_qty", totalQty: row.cow_qty, totalBonus: row.cow_qty * cowBonus, rate: cowBonus });
            if (row.hasBuffalo) milkTypes.push({ type: "BUF", milkKey: "buffalo_qty", totalQty: row.buffalo_qty, totalBonus: row.buffalo_qty * buffaloBonus, rate: buffaloBonus });

            return milkTypes.map((mt, mtIdx) => {
                // ── Per paired-column cells with real monthly data ──
                const pairedCells = pairedCols.map((col) => {
                    const topQty = getMonthQty(row.seller_id, col.top.key, mt.milkKey, mt.totalQty);
                    const topAmt = topQty * mt.rate;
                    const botQty = col.bottom ? getMonthQty(row.seller_id, col.bottom.key, mt.milkKey, mt.totalQty) : null;
                    const botAmt = botQty !== null ? botQty * mt.rate : null;

                    return `<td style="padding:2px 4px;border:1px solid #ccc;text-align:right;font-size:8.5px;vertical-align:top;min-width:58px">
                    <div style="padding-bottom:1px">${topQty.toFixed(1)}</div>
                    <div style="color:#777;font-size:8px">${topAmt.toFixed(1)}</div>
                    ${col.bottom
                            ? `<div style="border-top:1px solid #e0e0e0;margin-top:2px;padding-top:2px">${botQty.toFixed(1)}</div>
                           <div style="color:#777;font-size:8px">${botAmt.toFixed(1)}</div>`
                            : `<div style="border-top:1px solid #e0e0e0;margin-top:2px;padding-top:2px;color:#ccc">—</div>
                           <div style="color:#ccc;font-size:8px">—</div>`
                        }
                </td>`;
                }).join("");

                // ── Total Qty: sum of first-half months / second-half months (real data) ──
                const firstHalfQty = topMonths.reduce((a, m) =>
                    a + getMonthQty(row.seller_id, m.key, mt.milkKey, mt.totalQty), 0);
                const secondHalfQty = bottomMonths.reduce((a, m) =>
                    a + getMonthQty(row.seller_id, m.key, mt.milkKey, mt.totalQty), 0);

                const totalQtyCell = `<td style="padding:2px 5px;border:1px solid #ccc;text-align:right;font-size:8.5px;font-weight:700;background:#eef2ff;vertical-align:top;min-width:52px">
                <div style="padding-bottom:1px">${firstHalfQty.toFixed(1)}</div>
                <div style="border-top:1px solid #c7d6ff;margin-top:2px;padding-top:2px">${secondHalfQty.toFixed(1)}</div>
            </td>`;

                const totalAmtCell = `<td style="padding:2px 5px;border:1px solid #ccc;text-align:right;font-size:8.5px;font-weight:700;background:#e6f7ee;vertical-align:top;min-width:62px">
                <div style="padding-bottom:1px">${mt.totalQty.toFixed(1)} L</div>
                <div style="border-top:1px solid #b8eccf;margin-top:2px;padding-top:2px;color:#0a6e3a">₹${mt.totalBonus.toFixed(2)}</div>
            </td>`;

                const pct = row.percentage_increase ?? 0;
                const pctColor = pct > 0 ? "#059669" : pct < 0 ? "#dc2626" : "#6b7280";
                const pctStr = pct > 0 ? `+${pct}` : `${pct}`;
                const bgColor = brnCounter % 2 === 0 ? "#f9fafb" : "#ffffff";

                return `<tr style="background:${bgColor}">
                ${mtIdx === 0 ? `
                <td style="padding:3px 4px;border:1px solid #ccc;text-align:center;font-size:8.5px;font-weight:700;vertical-align:middle" rowspan="${milkTypes.length}">${brn}</td>
                <td style="padding:3px 4px;border:1px solid #ccc;text-align:center;font-size:8.5px;vertical-align:middle" rowspan="${milkTypes.length}">${mem}</td>
                <td style="padding:3px 5px;border:1px solid #ccc;font-size:8.5px;font-weight:600;vertical-align:middle;max-width:110px;word-break:break-word" rowspan="${milkTypes.length}">${row.name}</td>
                ` : ""}
                <td style="padding:3px 4px;border:1px solid #ccc;text-align:center;font-size:8.5px;font-weight:700;vertical-align:middle">${mt.type}</td>
                <td style="padding:3px 4px;border:1px solid #ccc;text-align:center;font-size:8.5px;font-weight:600;color:${pctColor};vertical-align:middle">${pctStr}%</td>
                ${pairedCells}
                ${totalQtyCell}
                ${totalAmtCell}
            </tr>`;
            });
        }).join("");

        // ── Grand totals ────────────────────────────────────────
        const grandTotalQty = filtered.reduce((a, r) => a + r.cow_qty + r.buffalo_qty, 0);
        const grandTotalBonus = filtered.reduce((a, r) => a + (r.cow_qty * cowBonus + r.buffalo_qty * buffaloBonus), 0);

        // Real half-totals: sum all sellers' real monthly qty across each half
        const grandFirstHalf = filtered.reduce((acc, row) =>
            acc + topMonths.reduce((a, m) =>
                a + getMonthQty(row.seller_id, m.key, "cow_qty", row.cow_qty)
                + getMonthQty(row.seller_id, m.key, "buffalo_qty", row.buffalo_qty), 0), 0);
        const grandSecondHalf = filtered.reduce((acc, row) =>
            acc + bottomMonths.reduce((a, m) =>
                a + getMonthQty(row.seller_id, m.key, "cow_qty", row.cow_qty)
                + getMonthQty(row.seller_id, m.key, "buffalo_qty", row.buffalo_qty), 0), 0);

        // ── Month header cells ──────────────────────────────────
        const monthHeaderCells = pairedCols.map(col =>
            `<th style="padding:4px 3px;border:1px solid #555;background:#1a1a1a;color:#fff;font-size:8px;text-align:center;min-width:58px;line-height:1.4">
            <span style="display:block;font-weight:700">${MON_NAMES[col.top.month]}</span>
            <span style="display:block;font-size:7px;opacity:0.6">${col.top.year}</span>
            <div style="border-top:1px solid #555;margin-top:2px;padding-top:2px;font-weight:700">${col.bottom ? MON_NAMES[col.bottom.month] : "—"}</div>
            <span style="display:block;font-size:7px;opacity:0.6">${col.bottom?.year ?? ""}</span>
        </th>`
        ).join("");

        const grandMonthCells = pairedCols.map(() =>
            `<td style="padding:4px;border:1px solid #555;background:#222"></td>`
        ).join("");

        const periodLabel = `${new Date(activeFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })} TO ${new Date(activeTo).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

        win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${appName} — Gavali Bonus Register${selectedEvent ? " — " + selectedEvent.event_name : ""}</title>
<style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #111; margin: 0; padding: 10px; }
    table { border-collapse: collapse; width: 100%; }
    @media print {
        @page { margin: 5mm; size: A3 landscape; }
        body { font-size: 8px; padding: 4px; }
    }
</style>
</head>
<body>

<div style="text-align:center;margin-bottom:8px">
    <div style="font-size:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${appName}</div>
    <div style="font-size:11px;font-weight:bold;margin-top:2px;text-transform:uppercase">
        GAVALI BONUS-REPORT FOR THE PERIOD ${periodLabel}
    </div>
    <div style="font-size:9px;color:#555;margin-top:2px">
        ${selectedEvent?.event_name || "Bonus Register"} &nbsp;·&nbsp;
        ${filtered.length} Sellers &nbsp;·&nbsp;
        Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </div>
</div>

<table>
    <thead>
        <tr>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#1a1a1a;color:#fff;font-size:8px;text-align:center;min-width:28px">SR<br/>NO</th>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#1a1a1a;color:#fff;font-size:8px;text-align:center;min-width:28px">MEM</th>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#1a1a1a;color:#fff;font-size:8px;text-align:left;min-width:100px">NAME</th>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#1a1a1a;color:#fff;font-size:8px;text-align:center;min-width:28px">B/C</th>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#0a3d8f;color:#fff;font-size:8px;text-align:center;min-width:36px">(%)</th>
            ${monthHeaderCells}
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#0a3d8f;color:#fff;font-size:8px;text-align:center;min-width:52px">Total<br/>Qty</th>
            <th rowspan="2" style="padding:4px;border:1px solid #555;background:#0a3d8f;color:#fff;font-size:8px;text-align:center;min-width:62px">Total Qty<br/>Amt</th>
        </tr>
        <tr></tr>
    </thead>
    <tbody>
        ${dataRows}
        <tr style="background:#111;color:#fff;font-weight:bold;border-top:2px solid #555">
            <td colspan="5" style="padding:5px 7px;border:1px solid #444;font-size:9px">
                GRAND TOTAL &nbsp;(${filtered.length} Sellers)
            </td>
            ${grandMonthCells}
            <td style="padding:4px 6px;border:1px solid #444;text-align:right;font-size:9px;vertical-align:top;color:#a5f3fc">
                <div>${grandFirstHalf.toFixed(1)} L</div>
                <div style="border-top:1px solid #444;margin-top:2px;padding-top:2px">${grandSecondHalf.toFixed(1)} L</div>
            </td>
            <td style="padding:4px 6px;border:1px solid #444;text-align:right;font-size:9px;vertical-align:top;color:#6ee7b7">
                <div>${grandTotalQty.toFixed(1)} L</div>
                <div style="border-top:1px solid #444;margin-top:2px;padding-top:2px">₹${grandTotalBonus.toFixed(2)}</div>
            </td>
        </tr>
    </tbody>
</table>

<div style="margin-top:16px;display:flex;justify-content:space-between;font-size:8px;color:#888">
    <span>Computer Generated · ${appName}</span>
    <span>Authorised Signatory: ___________________________</span>
</div>

<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
        win.document.close();
    };

    // ── Slab Editing ────────────────────────────────────────────
    const handleSlabChange = (idx, field, val) =>
        setDraftSlabs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: parseFloat(val) || 0 } : s));

    const handleSaveSlabs = () => {
        setSlabs(draftSlabs);
        setEditingSlabs(false);
        showFlash("success", t('gavaliBonus.slabUpdateSuccess'));
    };

    // ── Filtered List ───────────────────────────────────────────
    const filtered = rows.filter(r => {
        const matchSearch =
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            (r.seller_code || "").toLowerCase().includes(search.toLowerCase());
        const matchPaid =
            filterPaid === "all" ? true :
                filterPaid === "paid" ? r.is_paid : !r.is_paid;
        return matchSearch && matchPaid;
    });

    // ── Totals ─────────────────────────────────────────────────
    const grandQty = rows.reduce((a, r) => a + r.total_qty, 0);
    const grandBonus = rows.reduce((a, r) => a + r.total_bonus, 0);
    const paidCount = rows.filter(r => r.is_paid).length;

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

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Gift size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('gavaliBonus.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('gavaliBonus.pageSubtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="gavali-header-actions">
                        <button
                            onClick={startGavaliBonusTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition mt-4"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        {/* Event selector */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.bonusEvent')}</span>
                            <select
                                value={selectedEventId ?? "none"}
                                onChange={e => setSelectedEventId(e.target.value === "none" ? null : Number(e.target.value))}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition max-w-[200px]">
                                <option value="none">{t('gavaliBonus.noEvent')}</option>
                                {events.map(ev => (
                                    <option key={ev.event_id} value={ev.event_id}>
                                        {ev.event_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Show active event date range */}
                        {selectedEvent && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.period')}</span>
                                <span className="text-xs font-semibold text-gray-600 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    {fmtDate(activeFrom)} → {fmtDate(activeTo)}
                                </span>
                            </div>
                        )}

                        <button onClick={() => setShowNewEventForm(v => !v)}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-amber-500 text-white hover:bg-amber-600 transition mt-4">
                            <Plus size={13} /> {t('gavaliBonus.newEvent')}
                        </button>

                        {selectedEvent && (
                            <>
                                <button onClick={handleEditEvent}
                                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                        bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition mt-4">
                                    <Edit2 size={13} /> {t('gavaliBonus.editEvent')}
                                </button>
                                <button onClick={handleDeleteEvent} disabled={deletingEvent}
                                    className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                        bg-rose-500 text-white hover:bg-rose-600 transition mt-4 disabled:opacity-50">
                                    {deletingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                    {t('gavaliBonus.deleteEvent')}
                                </button>
                            </>
                        )}

                        <button onClick={handlePrint}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-black text-white hover:bg-gray-800 transition mt-4">
                            <Printer size={13} /> {t('gavaliBonus.print')}
                        </button>
                    </div>
                </div>

                {/* ── New Event Form ── */}
                {showNewEventForm && (
                    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-6 py-5 flex flex-col gap-4 no-print">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-amber-500" />
                                <span className="text-sm font-semibold text-gray-700">{t('gavaliBonus.createEvent')}</span>
                            </div>
                            <button onClick={() => setShowNewEventForm(false)} className="text-gray-300 hover:text-gray-500">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.eventName')}</span>
                                <input value={newEvent.event_name}
                                    onChange={e => setNewEvent(p => ({ ...p, event_name: e.target.value }))}
                                    placeholder={t('gavaliBonus.eventNamePlaceholder')}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition w-44" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.occasion')}</span>
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
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.fromDate')}</span>
                                <input type="date" value={newEvent.from_date}
                                    onChange={e => setNewEvent(p => ({ ...p, from_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.toDate')}</span>
                                <input type="date" value={newEvent.to_date}
                                    onChange={e => setNewEvent(p => ({ ...p, to_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <button onClick={handleCreateEvent} disabled={creatingEvent}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl
                                    bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition">
                                {creatingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                {t('gavaliBonus.createEventBtn')}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400">
                            {t('gavaliBonus.defaultRatesNote')}
                        </p>
                    </div>
                )}

                {/* ── Edit Event Form ── */}
                {editingEvent && editEventDraft && (
                    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm px-6 py-5 flex flex-col gap-4 no-print">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Edit2 size={14} className="text-blue-500" />
                                <span className="text-sm font-semibold text-gray-700">{t('gavaliBonus.editEventTitle')}</span>
                            </div>
                            <button onClick={() => setEditingEvent(false)} className="text-gray-300 hover:text-gray-500">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.eventName')}</span>
                                <input value={editEventDraft.event_name}
                                    onChange={e => setEditEventDraft(p => ({ ...p, event_name: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition w-44" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.occasion')}</span>
                                <select value={editEventDraft.occasion}
                                    onChange={e => setEditEventDraft(p => ({ ...p, occasion: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition">
                                    {["diwali", "holi", "eid", "custom"].map(o => (
                                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.fromDate')}</span>
                                <input type="date" value={editEventDraft.from_date}
                                    onChange={e => setEditEventDraft(p => ({ ...p, from_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.toDate')}</span>
                                <input type="date" value={editEventDraft.to_date}
                                    onChange={e => setEditEventDraft(p => ({ ...p, to_date: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                        focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <button onClick={handleSaveEditEvent} disabled={savingEvent}
                                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl
                                    bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                                {savingEvent ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                {t('gavaliBonus.saveChanges')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Date Range Controls ── */}
                <div className="flex items-center gap-3 flex-wrap no-print">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.from')}</span>
                        <input type="date" value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('gavaliBonus.to')}</span>
                        <input type="date" value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider opacity-0">{t('gavaliBonus.go')}</span>
                    </div>
                    {!selectedEvent && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium mt-4">
                            <Sparkles size={11} />
                            {t('gavaliBonus.noEventSelected')}
                        </div>
                    )}
                </div>

                {/* Print-only header */}
                <div className="hidden print:block mb-2">
                    <h2 className="text-xl font-bold">{t('gavaliBonus.pageTitle')}{selectedEvent ? ` — ${selectedEvent.event_name}` : ""}</h2>
                    <p className="text-sm text-gray-500">
                        {fmtDate(fromDate)} {t('gavaliBonus.to')} {fmtDate(toDate)}
                    </p>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-tour="gavali-stats">
                    <StatCard label={t('gavaliBonus.totalSellers')} value={rows.length}
                        icon={<Users size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label={t('gavaliBonus.totalQty')} value={`${fmtQty(grandQty)} L`}
                        icon={<Sparkles size={14} />}
                        color="text-amber-600 bg-amber-50 border-amber-100" />
                    <StatCard label={t('gavaliBonus.totalBonusAmt')} value={fmt(grandBonus)}
                        icon={<Banknote size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label={t('gavaliBonus.bonusRates')} value={t('gavaliBonus.ratesValue')}
                        icon={<Settings size={14} />}
                        color="text-violet-600 bg-violet-50 border-violet-100" />
                </div>

                {/* ── Progress bar ── */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 no-print" data-tour="gavali-progress">
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                            <span>{t('gavaliBonus.paymentProgress')}</span>
                            <span className="text-gray-700 font-semibold">{paidCount} / {rows.length} {t('gavaliBonus.paid')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: rows.length ? `${(paidCount / rows.length) * 100}%` : "0%" }} />
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={13} />
                        {rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0}% {t('gavaliBonus.done')}
                    </div>
                </div>

                {/* ── Flash ── */}
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

                {/* ── Slab Config ── */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden no-print" data-tour="gavali-config">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Settings size={14} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700">{t('gavaliBonus.bonusConfig')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
                                {t('gavaliBonus.ratesCount')}
                            </span>
                        </div>
                        {!editingSlabs ? (
                            <button
                                onClick={() => { setDraftSlabs(slabs); setEditingSlabs(true); }}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                                    bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                                <Edit2 size={11} /> {t('gavaliBonus.editRates')}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button onClick={handleSaveSlabs}
                                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg
                                        bg-gray-900 text-white hover:bg-gray-700 transition">
                                    <Check size={11} /> {t('gavaliBonus.save')}
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
                                style={{ gridTemplateColumns: "1fr 1fr 36px" }}>
                                <span>{t('gavaliBonus.milkType')}</span><span>{t('gavaliBonus.bonusPerL')}</span><span />
                            </div>
                            {draftSlabs.map((slab, idx) => (
                                <div key={idx}
                                    className="grid gap-2 items-center py-2 border-b border-gray-100 last:border-b-0"
                                    style={{ gridTemplateColumns: "1fr 1fr 36px" }}>
                                    <select
                                        value={slab.milk_type}
                                        onChange={e => handleSlabChange(idx, "milk_type", e.target.value)}
                                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                            focus:outline-none focus:ring-2 focus:ring-black transition">
                                        <option value="cow">{t('gavaliBonus.cow')}</option>
                                        <option value="buffalo">{t('gavaliBonus.buffalo')}</option>
                                    </select>
                                    <input type="number" step="0.1"
                                        value={slab.bonus}
                                        onChange={e => handleSlabChange(idx, "bonus", e.target.value)}
                                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                            focus:outline-none focus:ring-2 focus:ring-black transition" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap px-5 py-3">
                            {slabs.map((s, i) => (
                                <div key={i}
                                    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                                    <span className="font-semibold text-gray-700">
                                        {s.milk_type === "cow" ? t('gavaliBonus.cow') : t('gavaliBonus.buffalo')}
                                    </span>
                                    <span className="text-gray-300">|</span>
                                    <span className="font-bold text-gray-900">{t('gavaliBonus.bonus')} {fmt(s.bonus)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Search + Filter ── */}
                <div className="flex items-center gap-2 no-print" data-tour="gavali-search">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('gavaliBonus.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[["all", t('gavaliBonus.all')], ["unpaid", t('gavaliBonus.unpaid')], ["paid", t('gavaliBonus.paid')]].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterPaid(v)}
                                className={`px-3 py-2 transition
                                    ${filterPaid === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Seller Cards ── */}
                <div className="flex flex-col gap-3" data-tour="gavali-sellers">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Gift size={32} />
                            <p className="text-sm">{t('gavaliBonus.noSellersFound')}</p>
                        </div>
                    ) : filtered.map(row => {
                        const isOpen = expanded[row.seller_id];
                        return (
                            <div key={row.seller_id}
                                className={`bg-white rounded-2xl border transition-all print-break
                                    ${row.is_paid ? "border-emerald-200" : "border-gray-200"}`}>

                                {/* ── Row ── */}
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
                                                ? (
                                                    <>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                            <CheckCircle2 size={9} /> {t('gavaliBonus.paid')}
                                                        </span>
                                                        {row.percentage_increase > 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                <TrendingUp size={9} /> +{row.percentage_increase}% {t('gavaliBonus.vsLastYear')}
                                                            </span>
                                                        ) : row.percentage_increase < 0 ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                                                                <TrendingUp size={9} /> {row.percentage_increase}% {t('gavaliBonus.vsLastYear')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                                                                {row.percentage_increase}% {t('gavaliBonus.vsLastYear')}
                                                            </span>
                                                        )}
                                                    </>
                                                )
                                                : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                    <Clock size={9} /> {t('gavaliBonus.pending')}
                                                </span>
                                            }
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{row.seller_code}</p>
                                    </div>

                                    {/* Desktop: quantities and bonus */}
                                    <div className="hidden sm:flex items-center gap-4 text-right mr-4">
                                        {row.hasCow && (
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('gavaliBonus.cow')}</p>
                                                <p className="text-xs font-semibold text-blue-600">{fmtQty(row.cow_qty)} L</p>
                                                <p className="text-xs font-semibold text-gray-700">{fmt(row.cow_qty * (selectedEvent?.cow_bonus || 0.25))}</p>
                                            </div>
                                        )}
                                        {row.hasBuffalo && (
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('gavaliBonus.buffalo')}</p>
                                                <p className="text-xs font-semibold text-blue-600">{fmtQty(row.buffalo_qty)} L</p>
                                                <p className="text-xs font-semibold text-gray-700">{fmt(row.buffalo_qty * (selectedEvent?.buffalo_bonus || 0.50))}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('gavaliBonus.totalBonus')}</p>
                                            <p className="text-base font-bold text-gray-900">{fmt(row.total_bonus)}</p>
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
                                            {t('gavaliBonus.pay')} {fmt(row.total_bonus)}
                                        </button>
                                    ) : !row.is_paid && !selectedEventId ? (
                                        <span className="shrink-0 no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                            bg-gray-100 text-gray-400 text-xs font-semibold border border-gray-200">
                                            {t('gavaliBonus.selectEventToPay')}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={(e) => handleUndoPaid(e, row.seller_id)}
                                            disabled={undoing === row.seller_id}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                                bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold
                                                transition disabled:opacity-50 shadow-sm shadow-rose-200">
                                            {undoing === row.seller_id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <X size={11} />}
                                            {t('gavaliBonus.undo')}
                                        </button>
                                    )}

                                    <div className="shrink-0 text-gray-300">
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Mobile totals */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs">
                                    <span className="text-gray-400">{t('gavaliBonus.qty')}: <strong className="text-gray-700">{fmtQty(row.total_qty)} L</strong></span>
                                    <span className="font-bold text-gray-900">{t('gavaliBonus.bonus')}: {fmt(row.total_bonus)}</span>
                                </div>

                                {/* ── Expanded Breakdown ── */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
                                        {/* Cow Breakdown */}
                                        {row.hasCow && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('gavaliBonus.cowBonusBreakdown')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                                                        {[t('gavaliBonus.milkType'), t('gavaliBonus.qtyL'), t('gavaliBonus.bonusAmount')].map((h, i) => (
                                                            <div key={i} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    <div className="grid bg-white border-b border-gray-50 last:border-b-0"
                                                        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                                                        <div className="px-3 py-2 text-xs font-semibold text-gray-700">{t('gavaliBonus.cow')}</div>
                                                        <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{fmtQty(row.cow_qty)} L</div>
                                                        <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(row.cow_qty * (selectedEvent?.cow_bonus || 0.25))}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Buffalo Breakdown */}
                                        {row.hasBuffalo && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('gavaliBonus.buffaloBonusBreakdown')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100"
                                                        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                                                        {[t('gavaliBonus.milkType'), t('gavaliBonus.qtyL'), t('gavaliBonus.bonusAmount')].map((h, i) => (
                                                            <div key={i} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    <div className="grid bg-white border-b border-gray-50 last:border-b-0"
                                                        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                                                        <div className="px-3 py-2 text-xs font-semibold text-gray-700">{t('gavaliBonus.buffalo')}</div>
                                                        <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{fmtQty(row.buffalo_qty)} L</div>
                                                        <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(row.buffalo_qty * (selectedEvent?.buffalo_bonus || 0.50))}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Year-over-Year Comparison */}
                                        {row.last_year_qty !== undefined && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('gavaliBonus.yearOverYearComparison')}
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <p className="text-[9px] text-gray-400">{t('gavaliBonus.lastYearQty')} ({new Date().getFullYear() - 1})</p>
                                                        <p className="text-sm font-bold text-gray-700">{fmtQty(row.last_year_qty)} L</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-2">
                                                        <p className="text-[9px] text-gray-400">{t('gavaliBonus.currentYearQty')} ({new Date().getFullYear()})</p>
                                                        <p className="text-sm font-bold text-gray-700">{fmtQty(row.current_year_qty)} L</p>
                                                    </div>
                                                </div>
                                                <div className={`mt-2 p-2 rounded-lg ${row.percentage_increase > 0 ? 'bg-emerald-50' : row.percentage_increase < 0 ? 'bg-rose-50' : 'bg-gray-50'}`}>
                                                    <p className="text-[9px] text-gray-400">{t('gavaliBonus.growth')}</p>
                                                    <p className={`text-base font-bold ${row.percentage_increase > 0 ? 'text-emerald-600' : row.percentage_increase < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                                                        {row.percentage_increase > 0 ? '+' : ''}{row.percentage_increase}%
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Final Summary */}
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>{t('gavaliBonus.totalMilkQty')}: <strong className="text-gray-800 ml-1">{fmtQty(row.total_qty)} L</strong></p>
                                            {row.hasCow && <p>{t('gavaliBonus.cow')}: <strong className="text-gray-800 ml-1">{fmtQty(row.cow_qty)} L</strong></p>}
                                            {row.hasBuffalo && <p>{t('gavaliBonus.buffalo')}: <strong className="text-gray-800 ml-1">{fmtQty(row.buffalo_qty)} L</strong></p>}
                                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 text-white mt-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider">{row.milk_type} {t('gavaliBonus.netBonus')}</span>
                                                <span className="text-base font-bold">{fmt(row.total_bonus)}</span>
                                            </div>
                                        </div>

                                        {row.is_paid && row.paid_at && (
                                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                                <CheckCircle2 size={13} />
                                                {t('gavaliBonus.bonusPaidOn')} {fmtDate(row.paid_at)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Grand Total Footer ── */}
                {filtered.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('gavaliBonus.totalSellers')}</p>
                                <p className="font-bold text-gray-800">{filtered.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-blue-400 uppercase tracking-wider">{t('gavaliBonus.totalQty')}</p>
                                <p className="font-bold text-blue-600">
                                    {fmtQty(filtered.reduce((a, r) => a + r.total_qty, 0))} L
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-amber-400 uppercase tracking-wider">{t('gavaliBonus.cowQty')}</p>
                                <p className="font-bold text-amber-600">
                                    {fmtQty(filtered.reduce((a, r) => a + (r.cow_qty || 0), 0))} L
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-violet-400 uppercase tracking-wider">{t('gavaliBonus.buffaloQty')}</p>
                                <p className="font-bold text-violet-600">
                                    {fmtQty(filtered.reduce((a, r) => a + (r.buffalo_qty || 0), 0))} L
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('gavaliBonus.totalBonusToPay')}</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {fmt(filtered.reduce((a, r) => a + r.total_bonus, 0))}
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
                                    <h2 className="text-sm font-bold text-gray-900">{t('gavaliBonus.deleteEvent')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('gavaliBonus.deleteEventWarning')}</p>
                                </div>
                            </div>
                            <button onClick={() => setDeleteConfirmOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">
                                {t('gavaliBonus.deleteEventConfirm', { name: selectedEvent?.event_name })}
                            </p>
                            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700 flex flex-col gap-1">
                                <p className="font-semibold">{t('gavaliBonus.willBeDeleted')}:</p>
                                <ul className="list-disc list-inside text-rose-600 mt-1 space-y-0.5">
                                    <li>{t('gavaliBonus.deletePayments')}</li>
                                    <li>{t('gavaliBonus.deleteEventRecord')}</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={() => setDeleteConfirmOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                {t('gavaliBonus.cancel')}
                            </button>
                            <button onClick={confirmDeleteEvent} disabled={deletingEvent}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {deletingEvent
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Trash2 size={12} />}
                                {deletingEvent ? t('gavaliBonus.deleting') : t('gavaliBonus.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}