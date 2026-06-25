import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Truck, Save, AlertTriangle, BadgeCheck, RefreshCw,
    X, TrendingUp, Milk, FlaskConical, User, Hash,
    MapPin, Warehouse, ChevronDown, Calendar, FileDown, Plus,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';
import { useAppConfig } from '../../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";


// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const getShiftByTime = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 14 ? "morning" : "evening";
};
const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const EMPTY_TRUCK = {
    factory_name: "",
    vehicle_no: "",
    driver_name: "",
    cow_rate: "",
    buffalo_rate: "",
    cow_qty: "",
    buffalo_qty: "",
    remarks: "",
    shift: getShiftByTime(),
};
// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

function TinyInput({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TankDispatch() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    const [trucks, setTrucks] = useState([{ ...EMPTY_TRUCK }]);
    const [dispatches, setDispatches] = useState([]);
    const [stock, setStock] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stockLoading, setStockLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [prevDispatches, setPrevDispatches] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState({
        factory: false,
        vehicle: false,
        driver: false
    });
    const [flash, setFlash] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today());
    const [milkType, setMilkType] = useState("cow");
    const [dropdownOpen, setDropdownOpen] = useState({
        factory: false,
        vehicle: false,
        driver: false
    });
    const [highlightedIdx, setHighlightedIdx] = useState({
        factory: -1,
        vehicle: -1,
        driver: -1
    });
    const [editingDispatch, setEditingDispatch] = useState(null);
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeDispatches, setRangeDispatches] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [activeTruckIdx, setActiveTruckIdx] = useState(0);
    const activeTruck = trucks[activeTruckIdx] || {};
    const setTruckField = (idx, k, v) => setTrucks(p => {
        const t = [...p];
        t[idx] = { ...t[idx], [k]: v };
        return t;
    });
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const { appName } = useAppConfig();

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startDispatchTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="dispatch-header-actions"]',
                    popover: { title: t('tankDispatch.dateLabel'), description: 'Select a date to view or record dispatches. Switch between daily, weekly, monthly, or custom range. Download a PDF register or print a combined challan for the day.' },
                },
                {
                    element: '[data-tour="dispatch-stats"]',
                    popover: { title: t('tankDispatch.dispatches'), description: 'Live summary of total dispatches, total milk dispatched, factory revenue earned, and remaining stock available for dispatch.' },
                },
                {
                    element: '[data-tour="dispatch-stock"]',
                    popover: { title: t('tankDispatch.cowRemaining'), description: 'Click Cow or Buffalo to select the milk type for dispatch. The ready-to-dispatch panel shows the quantity and quality (FAT%, SNF%) available.' },
                },
                {
                    element: '[data-tour="dispatch-form"]',
                    popover: { title: t('tankDispatch.newDispatchEntry'), description: 'Fill in factory, vehicle, driver, and optional remarks. Enter cow and buffalo quantities and rates per litre — amounts are computed automatically. Add multiple trucks if needed.' },
                },
                {
                    element: '[data-tour="dispatch-table"]',
                    popover: { title: t('tankDispatch.colFactory'), description: 'All dispatches for the selected date. Print individual challans using the PDF button on each row. Admins can edit any dispatch record.' },
                },
            ],
        });
        driverObj.drive();
    };

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return { from: new Date(y, m, 1).toISOString().split("T")[0], to: new Date(y, m + 1, 0).toISOString().split("T")[0] };
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        setPdfReady(false);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") { newFrom = selectedDate; newTo = selectedDate; }
        else if (mode === "weekly") { const r = getWeekRange(selectedDate); newFrom = r.from; newTo = r.to; }
        else if (mode === "monthly") { const r = getMonthRange(selectedDate); newFrom = r.from; newTo = r.to; }
        setFromDate(newFrom);
        setToDate(newTo);
        if (mode !== "daily" && mode !== "custom") fetchRangeDispatches(newFrom, newTo);
    };

    const fetchRangeDispatches = async (overrideFrom, overrideTo) => {
        const f = overrideFrom || fromDate;
        const t2 = overrideTo || toDate;
        setLoadingRange(true);
        try {
            const url = f === t2
                ? `/tank-dispatch?date=${f}`
                : `/tank-dispatch?from=${f}&to=${t2}`;
            const { data } = await api.get(url);
            setRangeDispatches(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('tankDispatch.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
    };

    const handlePrintRegister = () => {
        const baseData = rangeMode === "daily" ? dispatches : (pdfReady ? rangeDispatches : dispatches);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const fmtT = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
        const modeLabel = rangeMode === "daily" ? t('tankDispatch.pdfDaily')
            : rangeMode === "weekly" ? t('tankDispatch.pdfWeekly')
                : rangeMode === "monthly" ? t('tankDispatch.pdfMonthly')
                    : t('tankDispatch.pdfCustom');
        const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('tankDispatch.pdfTo')} ${fmtD(toDate)}`;

        const totalL = baseData.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
        const totalAmt = baseData.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
        const cowData = baseData.filter(d => d.milk_type === "cow");
        const bufData = baseData.filter(d => d.milk_type === "buffalo");
        const cowL = cowData.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
        const bufL = bufData.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);

        // Group by date + shift
        const shiftGroups = [];
        const seen = new Map();
        for (const d of [...baseData].sort((a, b) => new Date(a.dispatch_date) - new Date(b.dispatch_date) || (a.shift === 'morning' ? -1 : 1))) {
            const key = d.dispatch_date + '|' + d.shift;
            if (!seen.has(key)) { seen.set(key, []); shiftGroups.push(key); }
            seen.get(key).push(d);
        }

        const rows = shiftGroups.map((key, gi) => {
            const group = seen.get(key);
            const [date, shift] = key.split('|');
            const cowRow = group.find(d => d.milk_type === 'cow');
            const bufRow = group.find(d => d.milk_type === 'buffalo');
            const grpLiters = group.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
            const grpAmt = group.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
            const shiftLabel = shift === 'morning' ? t('tankDispatch.morningShift') : t('tankDispatch.eveningShift');
            const bg = gi % 2 === 0 ? '#fff' : '#f2f2f2';
            const mkCell = (d) => d ? `
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${parseFloat(d.total_liters).toFixed(1)}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${d.avg_fat ? parseFloat(d.avg_fat).toFixed(2) + '%' : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${d.avg_snf ? parseFloat(d.avg_snf).toFixed(2) + '%' : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${d.factory_rate ? '₹' + parseFloat(d.factory_rate).toFixed(2) : '—'}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:700;color:#000">₹${parseFloat(d.total_amount || 0).toFixed(2)}</td>
    ` : `<td colspan="5" style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#aaa;text-align:center">—</td>`;
            // Sub-group by truck within the shift
            const truckMap = new Map();
            for (const d of group) {
                const tk = d.vehicle_no || d.factory_name || d.dispatch_id;
                if (!truckMap.has(tk)) truckMap.set(tk, { cow: null, buffalo: null });
                truckMap.get(tk)[d.milk_type] = d;
            }
            const trucks = [...truckMap.values()];

            return trucks.map((truck, ti) => {
                const { cow: cowRow, buffalo: bufRow } = truck;
                const truckMeta = cowRow || bufRow;
                const truckAmt = (parseFloat(cowRow?.total_amount || 0) + parseFloat(bufRow?.total_amount || 0));
                return `
    <tr style="background:${bg}">
        ${ti === 0 ? `<td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000;font-weight:600;vertical-align:top" rowspan="${trucks.length}">${fmtD(date)}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#555;vertical-align:top" rowspan="${trucks.length}">${shiftLabel}</td>` : ''}
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">${truckMeta?.factory_name || '—'}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;font-family:monospace;color:#000">${truckMeta?.vehicle_no || '—'}</td>
        <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">${truckMeta?.driver_name || '—'}</td>
        ${mkCell(cowRow)}
        ${mkCell(bufRow)}
        <td style="padding:4px 6px;border:1px solid #666;background:#e0e0e0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${truckAmt.toFixed(2)}</td>
    </tr>`;
            }).join('');
        }).join('');

        win.document.write(`<!DOCTYPE html><html><head>
        <title>${t('tankDispatch.pdfTitle')} — ${periodLabel}</title>
        <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            @media print {
                @page { margin: 8mm; size: A4 portrait; }
                body { padding: 0; font-size: 9px; }
            }
            @media screen {
                body { max-width: 175mm; margin: 0 auto; }
            }
        </style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
        <div>
            <div style="font-size:18px;font-weight:bold;color:#000">${t('tankDispatch.pdfTitle')}</div>
            <div style="font-size:11px;color:#333;margin-top:3px">${modeLabel} ${t('tankDispatch.pdfReport')} · ${periodLabel}</div>
            <div style="font-size:10px;color:#555;margin-top:2px">${t('tankDispatch.pdfGenerated')}: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
        </div>
        <div style="display:flex;gap:10px">
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('tankDispatch.pdfDispatches')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${baseData.length}</div>
            </div>
            <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('tankDispatch.cow')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${cowL.toFixed(1)} L</div>
            </div>
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('tankDispatch.buffalo')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${bufL.toFixed(1)} L</div>
            </div>
            <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('tankDispatch.total')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${totalL.toFixed(1)} L</div>
            </div>
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('tankDispatch.revenue')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">₹${totalAmt.toFixed(2)}</div>
            </div>
        </div>
    </div>
    <table>
        <thead>
    <tr style="background:#000;color:#fff">
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:9%">${t('tankDispatch.pdfDate')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:7%">Shift</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:12%">${t('tankDispatch.factory')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:8%">${t('tankDispatch.vehicle')}</th>
        <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:9%">${t('tankDispatch.driver')}</th>
        <th style="padding:5px 6px;border:1px solid #fff;font-size:9px;text-align:center;background:#1a1a1a" colspan="5">Cow</th>
        <th style="padding:5px 6px;border:1px solid #fff;font-size:9px;text-align:center;background:#333" colspan="5">Buffalo</th>
        <th style="padding:5px 6px;border:1px solid #333;background:#333;font-size:9px;text-align:right;width:8%">${t('tankDispatch.amount')}</th>
    </tr>
    <tr style="background:#222;color:#ccc">
        <th colspan="5" style="border:1px solid #444"></th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">L</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">FAT%</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">SNF%</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">Rate</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">Amt</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">L</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">FAT%</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">SNF%</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">Rate</th>
        <th style="padding:4px 6px;border:1px solid #444;font-size:8px;text-align:right">Amt</th>
        <th style="border:1px solid #333"></th>
    </tr>
</thead>
        <tbody>
            ${rows}
            <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
    <td colspan="5" style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:700;color:#000">${t('tankDispatch.pdfGrandTotal')} — ${[...seen.keys()].length} shifts · ${cowL.toFixed(1)}L · ${bufL.toFixed(1)}L</td>
    <td style="padding:5px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:700;color:#000">${cowL.toFixed(1)}</td>
    <td colspan="3" style="border:1px solid #999"></td>
    <td style="border:1px solid #999"></td>
    <td style="padding:5px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:700;color:#000">${bufL.toFixed(1)}</td>
    <td colspan="3" style="border:1px solid #999"></td>
    <td style="border:1px solid #999"></td>
    <td style="padding:5px 6px;border:1px solid #666;background:#d0d0d0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${totalAmt.toFixed(2)}</td>
</tr>
        </tbody>
    </table>
    <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
        <span>${t('tankDispatch.pdfFooter')}</span>
        <span>${t('tankDispatch.pdfSignatory')}</span>
    </div>
    <script>window.onload = () => { window.print(); };<\/script>
    </body></html>`);
        win.document.close();
    };

    // print individual challan
    const printChallan = (e, d) => {
        e.stopPropagation();
        const fmtD = (date) => date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
        const challanNo = d.dispatch_id || "—";
        const dispatchDate = fmtD(d.dispatch_date || d.created_at);
        const dispatchTime = d.created_at ? new Date(d.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
        const dispatchShift = (() => {
            if (!d.created_at) return "—";
            const h = new Date(d.created_at).getHours();
            return h >= 5 && h < 14 ? t('tankDispatch.morningShift') : t('tankDispatch.eveningShift');
        })();
        const fileName = `Challan_${d.factory_name || "Factory"}_${d.dispatch_date || today()}_No${challanNo}`;

        const cowRow = d.milk_type === "cow" ? `
    <tr>
        <td style="padding:8px 12px;border:1px solid #999;color:#000">${t('tankDispatch.cowMilk')}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${parseFloat(d.total_liters).toFixed(1)} L</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_fat ? parseFloat(d.avg_fat).toFixed(2) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_snf ? parseFloat(d.avg_snf).toFixed(2) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">12.5</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">2°C</td>
    </tr>` : "";

        const bufRow = d.milk_type === "buffalo" ? `
    <tr>
        <td style="padding:8px 12px;border:1px solid #999;color:#000">${t('tankDispatch.buffaloMilk')}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${parseFloat(d.total_liters).toFixed(1)} L</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_fat ? parseFloat(d.avg_fat).toFixed(2) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_snf ? parseFloat(d.avg_snf).toFixed(2) : "—"}</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">12.5</td>
        <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">2°C</td>
    </tr>` : "";

        const win = window.open("", "_blank", "width=850,height=950");
        if (!win) return;

        win.document.write(`<!DOCTYPE html><html><head>
    <title>${fileName}</title>
    <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 36px; background: #fff; }
        @media print {
            @page { margin: 12mm; size: A4 portrait; }
            body { padding: 0; }
        }
        @media screen {
            body { max-width: 190mm; margin: 0 auto; }
        }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e0e0e0; font-weight: bold; color: #000; }
    </style>
    </head><body>
    <div style="max-width:750px;margin:0 auto">

        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:20px">
            <div style="font-size:17px;font-weight:bold;letter-spacing:0.5px;color:#000">${appName}</div>
            <div style="font-size:12px;color:#333;margin-top:3px">Tal. Tasgaon, Dist. Sangli</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div>
                <div style="font-size:15px;font-weight:bold;color:#000">${t('tankDispatch.milkDeliveryChallan')}</div>
                <div style="font-size:12px;color:#333;margin-top:4px">${t('tankDispatch.tankerNo')}: <strong>${d.vehicle_no || "—"}</strong></div>
                <div style="font-size:12px;color:#333;margin-top:2px">${t('tankDispatch.driverLabel')}: <strong>${d.driver_name || "—"}</strong></div>
                <div style="font-size:12px;color:#333;margin-top:2px">${t('tankDispatch.shiftLabel')}: <strong>${dispatchShift}</strong></div>
                <div style="font-size:12px;color:#333;margin-top:2px">${t('tankDispatch.dispatchTime')}: <strong>${dispatchTime}</strong></div>
            </div>
            <div style="text-align:right;font-size:12px;color:#000">
                <div>${t('tankDispatch.date')}: <strong>${dispatchDate}</strong></div>
                <div style="margin-top:4px">${t('tankDispatch.challanNo')}: <strong>${challanNo}</strong></div>
                <div style="margin-top:4px">${t('tankDispatch.factoryLabel')}: <strong>${d.factory_name || "—"}</strong></div>
                <div style="margin-top:4px">FSSAI Lic. No.: <strong>11521040000016</strong></div>
            </div>
        </div>

        <div style="font-size:13px;font-weight:bold;margin-bottom:8px;text-decoration:underline;color:#000">${t('tankDispatch.milkDetails')}</div>
        <table>
            <thead>
                <tr>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:left">${t('tankDispatch.milkType')}</th>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:center">${t('tankDispatch.milkLtr')}</th>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:center">${t('tankDispatch.fatPercent')}</th>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:center">${t('tankDispatch.snfPercent')}</th>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:center">${t('tankDispatch.acidity')}</th>
                    <th style="padding:8px 12px;border:1px solid #999;text-align:center">${t('tankDispatch.temp')}</th>
                </tr>
            </thead>
            <tbody>
                ${cowRow}
                ${bufRow}
                <tr style="font-weight:bold;background:#f0f0f0">
                    <td style="padding:8px 12px;border:1px solid #999;color:#000">${t('tankDispatch.total')}</td>
                    <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${parseFloat(d.total_liters).toFixed(1)} L</td>
                    <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_fat ? parseFloat(d.avg_fat).toFixed(2) : "—"}</td>
                    <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">${d.avg_snf ? parseFloat(d.avg_snf).toFixed(2) : "—"}</td>
                    <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">12.5</td>
                    <td style="padding:8px 12px;border:1px solid #999;text-align:center;color:#000">2°C</td>
                </tr>
            </tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;margin-top:10px;font-size:12px;gap:24px;color:#000">
            ${d.factory_rate ? `<div>${t('tankDispatch.factoryRate')}: <strong>Rs.${parseFloat(d.factory_rate).toFixed(2)}/L</strong></div>` : ""}
            ${d.total_amount ? `<div>${t('tankDispatch.totalAmount')}: <strong>Rs.${parseFloat(d.total_amount).toFixed(2)}</strong></div>` : ""}
        </div>

        <div style="margin-top:24px;padding:10px 14px;border:1px solid #999;border-radius:4px;background:#f5f5f5;font-size:11px;color:#333;text-align:center;font-style:italic">
            Industrial raw milk under process — Not for Sale. Not for direct human consumption.
        </div>

        ${d.remarks ? `<div style="margin-top:12px;font-size:12px;color:#333">${t('tankDispatch.remarks')}: <em>${d.remarks}</em></div>` : ""}

        <div style="display:flex;justify-content:space-between;margin-top:60px;font-size:12px;color:#000">
            <div style="text-align:center">
                <div style="border-top:1px solid #000;width:180px;padding-top:6px">${t('tankDispatch.driverSignature')}</div>
            </div>
            <div style="text-align:center">
                <div style="border-top:1px solid #000;width:180px;padding-top:6px">${t('tankDispatch.authoritySignature')}</div>
            </div>
        </div>

        <div style="margin-top:24px;border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#666;text-align:center">
            Generated by Dairy Management System · ${new Date().toLocaleString("en-IN")}
        </div>
    </div>
    <script>
        window.onload = () => {
            document.title = "${fileName}";
            window.print();
        };
    <\/script>
    </body></html>`);
        win.document.close();
    };

    // print combined challan
    const printCombinedChallan = () => {
        const shifts = ["morning", "evening"];

        shifts.forEach(shift => {
            const shiftDispatches = dispatches.filter(d =>
                (d.shift || (new Date(d.created_at).getHours() >= 5 && new Date(d.created_at).getHours() < 14 ? "morning" : "evening")) === shift
            );
            if (shiftDispatches.length === 0) return;

            const win = window.open("", "_blank", "width=850,height=950");
            if (!win) return;

            const fmtD = (date) => date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
            const dispatchDate = fmtD(selectedDate);
            const shiftLabel = shift === "morning" ? t('tankDispatch.morningShift') : t('tankDispatch.eveningShift');
            const dispatchTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

            const cowDispatches = shiftDispatches.filter(d => d.milk_type === "cow");
            const bufDispatches = shiftDispatches.filter(d => d.milk_type === "buffalo");
            const totalCowL = cowDispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
            const totalBufL = bufDispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
            const totalL = totalCowL + totalBufL;

            const weightedFat = shiftDispatches.reduce((a, d) => a + parseFloat(d.avg_fat || 0) * parseFloat(d.total_liters || 0), 0) / (totalL || 1);
            const weightedSnf = shiftDispatches.reduce((a, d) => a + parseFloat(d.avg_snf || 0) * parseFloat(d.total_liters || 0), 0) / (totalL || 1);

            // Group cow+buffalo pairs by vehicle_no (or factory_name as fallback) = one physical truck
            const truckMap = new Map();
            for (const d of shiftDispatches) {
                const truckKey = d.vehicle_no || d.factory_name || d.dispatch_id;
                if (!truckMap.has(truckKey)) truckMap.set(truckKey, { cow: null, buffalo: null, meta: d });
                truckMap.get(truckKey)[d.milk_type] = d;
            }

            const truckRows = [...truckMap.values()].map(({ cow, buffalo, meta }) => {
                const truckL = (parseFloat(cow?.total_liters || 0) + parseFloat(buffalo?.total_liters || 0)).toFixed(1);
                const truckAmt = (parseFloat(cow?.total_amount || 0) + parseFloat(buffalo?.total_amount || 0)).toFixed(2);
                const commonCells = `
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#000">${meta.factory_name || "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;font-family:monospace;color:#000">${meta.vehicle_no || "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#000">${meta.driver_name || "—"}</td>`;
                return `
    <tr style="background:#fffbf0">
        ${commonCells}
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#92400e;font-weight:600">Cow</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${cow ? parseFloat(cow.total_liters).toFixed(1) + " L" : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${cow?.avg_fat ? parseFloat(cow.avg_fat).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${cow?.avg_snf ? parseFloat(cow.avg_snf).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">12.5</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">2°C</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:right;font-size:11px;color:#000">${cow?.factory_rate ? "₹" + parseFloat(cow.factory_rate).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #666;background:#e0e0e0;text-align:right;font-weight:700;font-size:11px;color:#000">${cow ? "₹" + parseFloat(cow.total_amount || 0).toFixed(2) : "—"}</td>
    </tr>
    <tr style="background:#f0f6ff">
        ${commonCells}
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#1e40af;font-weight:600">Buffalo</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${buffalo ? parseFloat(buffalo.total_liters).toFixed(1) + " L" : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${buffalo?.avg_fat ? parseFloat(buffalo.avg_fat).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${buffalo?.avg_snf ? parseFloat(buffalo.avg_snf).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">12.5</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">2°C</td>
        <td style="padding:6px 10px;border:1px solid #999;text-align:right;font-size:11px;color:#000">${buffalo?.factory_rate ? "₹" + parseFloat(buffalo.factory_rate).toFixed(2) : "—"}</td>
        <td style="padding:6px 10px;border:1px solid #666;background:#e0e0e0;text-align:right;font-weight:700;font-size:11px;color:#000">${buffalo ? "₹" + parseFloat(buffalo.total_amount || 0).toFixed(2) : "—"}</td>
    </tr>
    <tr style="background:#f5f5f5;font-weight:700;border-bottom:2px solid #ccc">
        <td colspan="3" style="padding:5px 10px;border:1px solid #999;font-size:10px;color:#555">Total — ${meta.vehicle_no || meta.factory_name}</td>
        <td style="padding:5px 10px;border:1px solid #999;font-size:10px;color:#333">${truckL} L combined</td>
        <td colspan="6" style="border:1px solid #999"></td>
        <td style="padding:5px 10px;border:1px solid #666;background:#d0d0d0;text-align:right;font-size:11px;font-weight:700;color:#000">₹${truckAmt}</td>
    </tr>`;
            }).join("");

            const grandTotal = shiftDispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
            const fileName = `Challan_Combined_${selectedDate}_${shift}`;

            win.document.write(`<!DOCTYPE html><html><head>
        <title>${fileName}</title>
        <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 28px; background: #fff; }
            @media print {
                @page { margin: 10mm; size: A4 portrait; }
                body { padding: 0; }
            }
            @media screen {
                body { max-width: 190mm; margin: 0 auto; }
            }
            table { width: 100%; border-collapse: collapse; }
            th { background: #e0e0e0; font-weight: bold; font-size: 11px; color: #000; }
        </style>
        </head><body>
        <div style="max-width:960px;margin:0 auto">

            <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:16px">
                <div style="font-size:17px;font-weight:bold;letter-spacing:0.5px;color:#000">${appName}</div>
                <div style="font-size:11px;color:#333;margin-top:2px">Tal. Tasgaon, Dist. Sangli</div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
                <div>
                    <div style="font-size:15px;font-weight:bold;color:#000">${t('tankDispatch.combinedChallan')}</div>
                    <div style="font-size:11px;color:#333;margin-top:3px">${t('tankDispatch.shift')}: <strong>${shiftLabel}</strong></div>
                    <div style="font-size:11px;color:#333;margin-top:2px">${t('tankDispatch.totalTrucks')}: <strong>${[...new Set(shiftDispatches.map(d => d.vehicle_no || d.factory_name))].length}</strong></div>

                    <div style="font-size:11px;color:#333;margin-top:2px">${t('tankDispatch.generated')}: <strong>${dispatchTime}</strong></div>
                </div>
                <div style="text-align:right;font-size:11px;color:#000">
                    <div>${t('tankDispatch.date')}: <strong>${dispatchDate}</strong></div>
                    <div style="margin-top:3px">FSSAI Lic. No.: <strong>11521040000016</strong></div>
                    <div style="margin-top:8px;display:flex;gap:10px;justify-content:flex-end">
                        <div style="background:#e8e8e8;border:1px solid #999;padding:5px 10px;border-radius:4px;text-align:center">
                            <div style="font-size:9px;font-weight:600;color:#000">${t('tankDispatch.cow')}</div>
                            <div style="font-size:14px;font-weight:700;color:#000">${totalCowL.toFixed(1)} L</div>
                        </div>
                        <div style="background:#d8d8d8;border:1px solid #999;padding:5px 10px;border-radius:4px;text-align:center">
                            <div style="font-size:9px;font-weight:600;color:#000">${t('tankDispatch.buffalo')}</div>
                            <div style="font-size:14px;font-weight:700;color:#000">${totalBufL.toFixed(1)} L</div>
                        </div>
                        <div style="background:#f0f0f0;border:1px solid #999;padding:5px 10px;border-radius:4px;text-align:center">
                            <div style="font-size:9px;font-weight:600;color:#000">${t('tankDispatch.total')}</div>
                            <div style="font-size:14px;font-weight:700;color:#000">${totalL.toFixed(1)} L</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="font-size:12px;font-weight:bold;margin-bottom:6px;text-decoration:underline;color:#000">${t('tankDispatch.dispatchDetails')}</div>
            <table>
                <thead>
    <tr style="background:#000;color:#fff">
        <th style="padding:7px 10px;border:1px solid #444;text-align:left;font-size:11px">Factory</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:left;font-size:11px">Vehicle</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:left;font-size:11px">Driver</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:left;font-size:11px">Milk Type</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:center;font-size:11px">Qty (L)</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:center;font-size:11px">FAT%</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:center;font-size:11px">SNF%</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:center;font-size:11px">Acidity</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:center;font-size:11px">Temp</th>
        <th style="padding:7px 10px;border:1px solid #444;text-align:right;font-size:11px">Rate/L</th>
        <th style="padding:7px 10px;border:1px solid #555;background:#333;text-align:right;font-size:11px">Amount</th>
    </tr>
</thead>
                <tbody>
                    ${truckRows}
                    <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
    <td colspan="3" style="padding:7px 10px;border:1px solid #999;font-size:11px;color:#000">Grand Total — ${truckMap.size} trucks</td>
    <td style="padding:7px 10px;border:1px solid #999;font-size:11px;color:#000">${totalCowL.toFixed(1)}L · ${totalBufL.toFixed(1)}L</td>
    <td style="padding:7px 10px;border:1px solid #999;text-align:center;font-size:11px;color:#000">${totalL.toFixed(1)} L</td>
    <td colspan="5" style="border:1px solid #999"></td>
    <td style="padding:7px 10px;border:1px solid #666;background:#d0d0d0;text-align:right;font-size:12px;font-weight:700;color:#000">₹${grandTotal.toFixed(2)}</td>
</tr>
                </tbody>
            </table>

            <div style="margin-top:16px;padding:8px 12px;border:1px solid #999;border-radius:4px;background:#f5f5f5;font-size:10px;color:#333;text-align:center;font-style:italic">
                Industrial raw milk under process — Not for Sale. Not for direct human consumption.
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:48px;font-size:11px;color:#000">
                <div style="text-align:center">
                    <div style="border-top:1px solid #000;width:160px;padding-top:5px">${t('tankDispatch.driverSignature')}</div>
                </div>
                <div style="text-align:center">
                    <div style="border-top:1px solid #000;width:160px;padding-top:5px">${t('tankDispatch.authoritySignature')}</div>
                </div>
            </div>

            <div style="margin-top:16px;border-top:1px solid #ccc;padding-top:6px;font-size:9px;color:#666;text-align:center">
                Generated by Dairy Management System · ${new Date().toLocaleString("en-IN")}
            </div>
        </div>
        <script>window.onload = () => { document.title = "${fileName}"; window.print(); };<\/script>
        </body></html>`);
            win.document.close();
        });
    };

    // computed dispatch quantity from remaining stock
    const dispatchQty = stock
        ? milkType === "cow" ? parseFloat(stock.available?.cow || 0)
            : parseFloat(stock.available?.buffalo || 0)
        : 0;

    const cowLiters = stock ? parseFloat(stock.available?.cow || 0) : 0;
    const buffaloLiters = stock ? parseFloat(stock.available?.buffalo || 0) : 0;

    const dispatchAvgFat = stock
        ? milkType === "cow" ? stock.avg_fat_cow : stock.avg_fat_buffalo
        : null;

    const dispatchAvgSnf = stock
        ? milkType === "cow" ? stock.avg_snf_cow : stock.avg_snf_buffalo
        : null;

    const totalAmount = null; // now computed per-truck inline in the form


    // fetch remaining stock for date
    const fetchStock = async (date) => {
        setStockLoading(true);
        try {
            const { data } = await api.get(`/stock/available?date=${date}`);
            setStock(data);
        } catch {
            setStock(null);
        } finally {
            setStockLoading(false);
        }
    };

    // fetch dispatches for date
    const fetchDispatches = async (from, to) => {
        setLoading(true);
        try {
            const resolvedTo = to || from;
            const url = from === resolvedTo
                ? `/tank-dispatch?date=${from}`
                : `/tank-dispatch?from=${from}&to=${resolvedTo}`;
            const { data } = await api.get(url);
            setDispatches(data);
        } catch {
            showFlash("error", t('tankDispatch.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // fetch history for suggestions
    const fetchHistory = async () => {
        try {
            const { data } = await api.get("/tank-dispatch/history");
            const rows = Array.isArray(data) ? data : [];
            setPrevDispatches(rows);

            const uniqueFactories = [...new Set(rows.map(d => d.factory_name).filter(Boolean))];
            const uniqueVehicles = [...new Set(rows.map(d => d.vehicle_no).filter(Boolean))];
            const uniqueDrivers = [...new Set(rows.map(d => d.driver_name).filter(Boolean))];

            setTrucks(prev => {
                const t0 = { ...prev[0] };
                if (uniqueFactories.length === 1) t0.factory_name = uniqueFactories[0];
                if (uniqueVehicles.length === 1) t0.vehicle_no = uniqueVehicles[0];
                if (uniqueDrivers.length === 1) t0.driver_name = uniqueDrivers[0];
                return [t0, ...prev.slice(1)];
            });
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    // Effect 1: stock always uses selectedDate
    useEffect(() => {
        fetchStock(selectedDate);
    }, [selectedDate]);

    // Effect 2: dispatches use the range
    useEffect(() => {
        fetchDispatches(fromDate, toDate);
        fetchHistory();
    }, [fromDate, toDate]);

    // save dispatch
    const handleSave = async () => {
        const validTrucks = trucks.filter(t => t.factory_name?.trim());
        if (validTrucks.length === 0) { showFlash("error", t('tankDispatch.factoryRequired')); return; }

        const cowStock = stock ? parseFloat(stock.available?.cow || 0) : 0;
        const bufStock = stock ? parseFloat(stock.available?.buffalo || 0) : 0;

        // Check if any truck has quantities
        const hasAnyQty = validTrucks.some(t =>
            (t.cow_qty && parseFloat(t.cow_qty) > 0) ||
            (t.buffalo_qty && parseFloat(t.buffalo_qty) > 0)
        );
        if (!hasAnyQty && cowStock <= 0 && bufStock <= 0) {
            showFlash("error", t('tankDispatch.noMilkRemaining')); return;
        }
        if (saving) return;

        const cowQtyPerTruck = cowStock / validTrucks.length;
        const bufQtyPerTruck = bufStock / validTrucks.length;
        const currentShift = getShiftByTime();

        setSaving(true);
        try {
            for (const t of validTrucks) {
                const usedCowQty = t.cow_qty && parseFloat(t.cow_qty) > 0
                    ? parseFloat(t.cow_qty) : cowQtyPerTruck;
                const usedBufQty = t.buffalo_qty && parseFloat(t.buffalo_qty) > 0
                    ? parseFloat(t.buffalo_qty) : bufQtyPerTruck;

                // Save cow row
                if (usedCowQty > 0) {
                    const cowAmt = t.cow_rate ? (usedCowQty * parseFloat(t.cow_rate)).toFixed(2) : 0;
                    await api.post("/tank-dispatch", {
                        dispatch_date: selectedDate,
                        milk_type: "cow",
                        cow_liters: Math.round(usedCowQty * 100) / 100,
                        buffalo_liters: 0,
                        total_liters: Math.round(usedCowQty * 100) / 100,
                        avg_fat: stock?.avg_fat_cow ? parseFloat(stock.avg_fat_cow) : null,
                        avg_snf: stock?.avg_snf_cow ? parseFloat(stock.avg_snf_cow) : null,
                        avg_fat_cow: stock?.avg_fat_cow ? parseFloat(stock.avg_fat_cow) : null,
                        avg_snf_cow: stock?.avg_snf_cow ? parseFloat(stock.avg_snf_cow) : null,
                        avg_fat_buffalo: stock?.avg_fat_buffalo ? parseFloat(stock.avg_fat_buffalo) : null,
                        avg_snf_buffalo: stock?.avg_snf_buffalo ? parseFloat(stock.avg_snf_buffalo) : null,
                        factory_name: t.factory_name.trim(),
                        vehicle_no: t.vehicle_no?.trim() || null,
                        driver_name: t.driver_name?.trim() || null,
                        factory_rate: t.cow_rate ? parseFloat(t.cow_rate) : null,
                        total_amount: t.cow_rate ? parseFloat(cowAmt) : 0,
                        remarks: t.remarks?.trim() || null,
                        shift: t.shift || currentShift,
                    });
                }

                // Save buffalo row
                if (usedBufQty > 0) {
                    const bufAmt = t.buffalo_rate ? (usedBufQty * parseFloat(t.buffalo_rate)).toFixed(2) : 0;
                    await api.post("/tank-dispatch", {
                        dispatch_date: selectedDate,
                        milk_type: "buffalo",
                        cow_liters: 0,
                        buffalo_liters: Math.round(usedBufQty * 100) / 100,
                        total_liters: Math.round(usedBufQty * 100) / 100,
                        avg_fat: stock?.avg_fat_buffalo ? parseFloat(stock.avg_fat_buffalo) : null,
                        avg_snf: stock?.avg_snf_buffalo ? parseFloat(stock.avg_snf_buffalo) : null,
                        avg_fat_cow: stock?.avg_fat_cow ? parseFloat(stock.avg_fat_cow) : null,
                        avg_snf_cow: stock?.avg_snf_cow ? parseFloat(stock.avg_snf_cow) : null,
                        avg_fat_buffalo: stock?.avg_fat_buffalo ? parseFloat(stock.avg_fat_buffalo) : null,
                        avg_snf_buffalo: stock?.avg_snf_buffalo ? parseFloat(stock.avg_snf_buffalo) : null,
                        factory_name: t.factory_name.trim(),
                        vehicle_no: t.vehicle_no?.trim() || null,
                        driver_name: t.driver_name?.trim() || null,
                        factory_rate: t.buffalo_rate ? parseFloat(t.buffalo_rate) : null,
                        total_amount: t.buffalo_rate ? parseFloat(bufAmt) : 0,
                        remarks: t.remarks?.trim() || null,
                        shift: t.shift || currentShift,
                    });
                }
            }

            await fetchDispatches(fromDate, toDate);
            await fetchStock(selectedDate);
            await fetchHistory();
            showFlash("success", t('tankDispatch.saveSuccess', { count: validTrucks.length }));
            setTrucks([{ ...EMPTY_TRUCK }]);
            setActiveTruckIdx(0);
            setDropdownOpen({ factory: false, vehicle: false, driver: false });
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('tankDispatch.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // edit dispatch (admin only)
    const handleEdit = (d) => {
        setEditingDispatch(d);
        setActiveTruckIdx(0);
        setMilkType(d.milk_type || "cow");
        setTrucks([{
            ...EMPTY_TRUCK,
            factory_name: d.factory_name || "",
            vehicle_no: d.vehicle_no || "",
            driver_name: d.driver_name || "",
            cow_rate: d.milk_type === "cow" && d.factory_rate ? String(d.factory_rate) : "",
            buffalo_rate: d.milk_type === "buffalo" && d.factory_rate ? String(d.factory_rate) : "",
            cow_qty: d.milk_type === "cow" ? String(d.total_liters) : "",
            buffalo_qty: d.milk_type === "buffalo" ? String(d.total_liters) : "",
            remarks: d.remarks || "",
        }]);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleUpdate = async () => {
        if (!activeTruck.factory_name?.trim()) {
            showFlash("error", t('tankDispatch.factoryRequired')); return;
        }
        if (saving) return;
        setSaving(true);
        try {
            const rateField = editingDispatch.milk_type === "cow" ? "cow_rate" : "buffalo_rate";
            const qtyField = editingDispatch.milk_type === "cow" ? "cow_qty" : "buffalo_qty";
            const editedQty = activeTruck[qtyField] && parseFloat(activeTruck[qtyField]) > 0
                ? parseFloat(activeTruck[qtyField])
                : parseFloat(editingDispatch.total_liters);
            const editedRate = activeTruck[rateField] ? parseFloat(activeTruck[rateField]) : null;

            await api.put(`/tank-dispatch/${editingDispatch.dispatch_id}`, {
                factory_name: activeTruck.factory_name.trim(),
                vehicle_no: activeTruck.vehicle_no?.trim() || null,
                driver_name: activeTruck.driver_name?.trim() || null,
                factory_rate: editedRate,
                total_liters: editedQty,
                cow_liters: editingDispatch.milk_type === "cow" ? editedQty : 0,
                buffalo_liters: editingDispatch.milk_type === "buffalo" ? editedQty : 0,
                total_amount: editedRate ? parseFloat((editedQty * editedRate).toFixed(2)) : editingDispatch.total_amount,
                remarks: activeTruck.remarks?.trim() || null,
            });
            showFlash("success", t('tankDispatch.updateSuccess'));
            await fetchDispatches(fromDate, toDate);
            setEditingDispatch(null);
            setTrucks([{ ...EMPTY_TRUCK }]);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('tankDispatch.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = () => {
        if (editingDispatch) return !!activeTruck.factory_name?.trim();
        const validTrucks = trucks.filter(t => t.factory_name?.trim());
        if (validTrucks.length === 0) return false;
        const cowStock = stock ? parseFloat(stock.available?.cow || 0) : 0;
        const bufStock = stock ? parseFloat(stock.available?.buffalo || 0) : 0;
        const hasAnyQty = validTrucks.some(t =>
            (t.cow_qty && parseFloat(t.cow_qty) > 0) ||
            (t.buffalo_qty && parseFloat(t.buffalo_qty) > 0)
        );
        return hasAnyQty || cowStock > 0 || bufStock > 0;
    };

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        // Let factory/vehicle/driver autocomplete dropdowns handle their own Enter
        if (dropdownOpen.factory || dropdownOpen.vehicle || dropdownOpen.driver) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving || !isFormReady()) return;
        editingDispatch ? handleUpdate() : handleSave();
    };

    const handleCancelEdit = () => {
        setEditingDispatch(null);
        setActiveTruckIdx(0);
        setTrucks([{ ...EMPTY_TRUCK }]);
    };

    // stats
    const totalDispatched = dispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
    const totalFactoryRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);

    // table
    const COLS = [
        t('tankDispatch.colFactory'), t('tankDispatch.colType'), t('tankDispatch.colVehicle'),
        t('tankDispatch.colDriver'), t('tankDispatch.colQtyL'), t('tankDispatch.colAvgFat'),
        t('tankDispatch.colAvgSnf'), t('tankDispatch.colRate'), t('tankDispatch.colAmount'),
        t('tankDispatch.colRemarks'), t('tankDispatch.colTime'), "", ...(isAdmin ? [t('tankDispatch.colEdit')] : [])
    ];
    const GRID = isAdmin
        ? "1.2fr 75px 85px 95px 75px 75px 75px 75px 95px 120px 70px 60px 60px"
        : "1.2fr 75px 85px 95px 75px 75px 75px 75px 95px 120px 70px 60px";

    // Helper function to get filtered suggestions
    const getFilteredSuggestions = (field, value) => {
        const fieldMap = { factory: "factory_name", vehicle: "vehicle_no", driver: "driver_name" };
        const key = fieldMap[field];

        if (field === "factory") {
            const seen = new Set();
            const results = [];
            for (const d of prevDispatches) {
                if (!d.factory_name) continue;
                if (value && !d.factory_name.toLowerCase().includes(value.toLowerCase())) continue;
                if (!seen.has(d.factory_name)) {
                    seen.add(d.factory_name);
                    results.push({
                        factory_name: d.factory_name,
                        vehicle_no: d.vehicle_no || "",
                        driver_name: d.driver_name || "",
                        factory_rate: d.factory_rate || "",
                    });
                }
            }
            return results.slice(0, 5);
        }

        const currentFactory = activeTruck.factory_name;
        const pool = currentFactory
            ? prevDispatches.filter(d => d.factory_name === currentFactory)
            : prevDispatches;

        return [...new Set(pool.map(d => d[key]).filter(Boolean))]
            .filter(v => !value || v.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 5);
    };

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('product_sales', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Truck size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('tankDispatch.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('tankDispatch.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="dispatch-header-actions">
                        <button
                            onClick={startDispatchTour}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('tankDispatch.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeDispatches(r.from, r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeDispatches(r.from, r.to); }
                                }}y
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('tankDispatch.registerPDF')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[{ v: "daily", l: t('tankDispatch.day') }, { v: "weekly", l: t('tankDispatch.week') }, { v: "monthly", l: t('tankDispatch.month') }, { v: "custom", l: t('tankDispatch.custom') }].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPdfReady(false); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => {
                                            setToDate(e.target.value);
                                            setPdfReady(false);
                                            // auto-fetch when toDate is selected
                                            setTimeout(() => fetchRangeDispatches(), 0);
                                        }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {rangeMode === "daily" && dispatches.length > 0 && (
                                        <button onClick={printCombinedChallan}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition">
                                            <FileDown size={13} />
                                            <span className="hidden sm:inline">{t('tankDispatch.combined')} </span>{t('tankDispatch.challan')}
                                        </button>
                                    )}
                                    {rangeMode === "daily" ? (
                                        <button onClick={handlePrintRegister} disabled={dispatches.length === 0}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                            <FileDown size={13} /> PDF
                                        </button>
                                    ) : (
                                        <>
                                            <button onClick={handlePrintRegister} disabled={!pdfReady}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                                <FileDown size={13} /> PDF
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="dispatch-stats">                    {[
                        { label: t('tankDispatch.dispatches'), value: `${dispatches.length} (${[...new Set(dispatches.map(d => d.shift + d.dispatch_date))].length} shifts)`, icon: <Truck size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('tankDispatch.totalDispatched'), value: totalDispatched.toFixed(1) + " L", icon: <Milk size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        { label: t('tankDispatch.factoryRevenue'), value: "₹" + totalFactoryRev.toFixed(2), icon: <TrendingUp size={14} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        {
                            label: t('tankDispatch.remainingStock'), value: stock ? parseFloat(stock.available?.total || 0).toFixed(1) + " L" : "—", icon: <Warehouse size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100"
                        },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                            <div className="shrink-0">{icon}</div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none">{label}</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Stock + Dispatch Summary */}
                <div className="grid grid-cols-3 gap-2" data-tour="dispatch-stock">

                    {/* Cow */}
                    <div onClick={() => setMilkType("cow")} style={{ cursor: "pointer" }}
                        className={`flex flex-col px-3 py-3 rounded-2xl border transition
                            ${milkType === "cow" ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200" : "border-amber-100 bg-amber-50/50"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-amber-400 flex items-center justify-center text-xs shrink-0"></div>
                            <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">{t('tankDispatch.cowRemaining')}</p>
                            {milkType === "cow" && <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900">✓</span>}
                        </div>
                        <p className="text-2xl font-bold text-amber-800 leading-tight">
                            {stockLoading ? "…" : parseFloat(stock?.available?.cow || 0).toFixed(1)}
                            <span className="text-sm font-medium text-amber-500 ml-1">L</span>
                        </p>
                        {stock?.avg_fat_cow && (
                            <p className="text-[9px] text-amber-500 mt-0.5">
                                {t('tankDispatch.fat')}: {parseFloat(stock.avg_fat_cow).toFixed(2)}% · {t('tankDispatch.snf')}: {parseFloat(stock.avg_snf_cow).toFixed(2)}%
                            </p>
                        )}
                    </div>

                    {/* Buffalo */}
                    <div onClick={() => setMilkType("buffalo")} style={{ cursor: "pointer" }}
                        className={`flex flex-col px-3 py-3 rounded-2xl border transition
                            ${milkType === "buffalo" ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200" : "border-blue-100 bg-blue-50/50"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-xs shrink-0"></div>
                            <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-wider">{t('tankDispatch.buffaloRemaining')}</p>
                            {milkType === "buffalo" && <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">✓</span>}
                        </div>
                        <p className="text-2xl font-bold text-blue-800 leading-tight">
                            {stockLoading ? "…" : parseFloat(stock?.available?.buffalo || 0).toFixed(1)}
                            <span className="text-sm font-medium text-blue-400 ml-1">L</span>
                        </p>
                        {stock?.avg_fat_buffalo && (
                            <p className="text-[9px] text-blue-400 mt-0.5">
                                {t('tankDispatch.fat')}: {parseFloat(stock.avg_fat_buffalo).toFixed(2)}% · {t('tankDispatch.snf')}: {parseFloat(stock.avg_snf_buffalo).toFixed(2)}%
                            </p>
                        )}
                    </div>

                    {/* Dispatch Summary */}
                    <div className={`flex flex-col px-3 py-3 rounded-2xl border transition
                        ${dispatchQty > 0 ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                <Truck size={13} className={dispatchQty > 0 ? "text-white" : "text-gray-400"} />
                            </div>
                            <p className={`text-[9px] font-semibold uppercase tracking-wider ${dispatchQty > 0 ? "text-gray-400" : "text-gray-400"}`}>{t('tankDispatch.readyToDispatch')}</p>
                        </div>
                        <p className={`text-2xl font-bold leading-tight ${dispatchQty > 0 ? "text-white" : "text-gray-300"}`}>
                            {dispatchQty > 0 ? dispatchQty.toFixed(1) : "—"}
                            {dispatchQty > 0 && <span className="text-sm font-normal text-gray-400 ml-1">{milkType === "cow" ? t('tankDispatch.cow') : t('tankDispatch.buf')} L</span>}
                        </p>
                        {dispatchQty > 0 && (
                            <div className="flex gap-3 mt-0.5 flex-wrap">
                                {dispatchAvgFat && <p className="text-[9px] text-amber-400">{t('tankDispatch.fat')}: {parseFloat(dispatchAvgFat).toFixed(2)}%</p>}
                                {dispatchAvgSnf && <p className="text-[9px] text-blue-400">{t('tankDispatch.snf')}: {parseFloat(dispatchAvgSnf).toFixed(2)}%</p>}
                                {totalAmount && <p className="text-[9px] text-emerald-400">₹{totalAmount}</p>}
                            </div>
                        )}
                    </div>

                </div>

                {/* Entry Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5" data-tour="dispatch-form">
                    <div className="flex items-center gap-2 mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            {editingDispatch ? t('tankDispatch.editDispatch') : t('tankDispatch.newDispatchEntry')}
                        </p>
                        {editingDispatch && (
                            <button onClick={handleCancelEdit}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                                <X size={12} /> {t('tankDispatch.cancelEdit')}
                            </button>
                        )}
                    </div>

                    {editingDispatch && (
                        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                            ✏ {t('tankDispatch.editingDispatchTo')} <strong>{editingDispatch.factory_name}</strong> · {editingDispatch.milk_type === "cow" ? t('tankDispatch.cow') : t('tankDispatch.buffalo')} · {parseFloat(editingDispatch.total_liters).toFixed(1)} L
                        </div>
                    )}

                    {/* Truck forms */}
                    {trucks.map((truckForm, truckIdx) => {
                        const isActive = activeTruckIdx === truckIdx;
                        const cowStock = stock ? parseFloat(stock.available?.cow || 0) : 0;
                        const bufStock = stock ? parseFloat(stock.available?.buffalo || 0) : 0;
                        const cowQtyDefault = (cowStock / trucks.length).toFixed(1);
                        const bufQtyDefault = (bufStock / trucks.length).toFixed(1);
                        const cowQty = truckForm.cow_qty && parseFloat(truckForm.cow_qty) > 0 ? parseFloat(truckForm.cow_qty) : (cowStock / trucks.length);
                        const bufQty = truckForm.buffalo_qty && parseFloat(truckForm.buffalo_qty) > 0 ? parseFloat(truckForm.buffalo_qty) : (bufStock / trucks.length);
                        const cowAmt = truckForm.cow_rate && cowQty ? (cowQty * parseFloat(truckForm.cow_rate)).toFixed(2) : null;
                        const bufAmt = truckForm.buffalo_rate && bufQty ? (bufQty * parseFloat(truckForm.buffalo_rate)).toFixed(2) : null;

                        const mkSet = (k, v) => setTruckField(truckIdx, k, v);

                        return (
                            <div key={truckIdx}
                                className={`mb-4 p-4 rounded-xl border-2 transition ${isActive ? "border-gray-300 bg-gray-50/50" : "border-gray-100"}`}
                                style={{ overflow: "visible" }}
                                onClick={() => setActiveTruckIdx(truckIdx)}
                                onKeyDown={handleFormKeyDown}>

                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        {t('tankDispatch.truck')} {truckIdx + 1}
                                    </span>
                                    {truckIdx > 0 && (
                                        <button type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTrucks(p => p.filter((_, i) => i !== truckIdx));
                                                setActiveTruckIdx(0);
                                            }}
                                            className="ml-auto flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition">
                                            <X size={11} /> {t('tankDispatch.remove')}
                                        </button>
                                    )}
                                </div>

                                {/* Common fields */}
                                <div className="flex flex-wrap items-start gap-2 mb-3 pb-3 border-b border-gray-100">
                                    <Field label={t('tankDispatch.factoryName')} icon={<Warehouse size={12} />}>
                                        <div className="relative">
                                            <TinyInput
                                                value={truckForm.factory_name || ""}
                                                onFocus={() => { setActiveTruckIdx(truckIdx); setDropdownOpen(p => ({ ...p, factory: true })); setHighlightedIdx(p => ({ ...p, factory: -1 })); }}
                                                onBlur={() => setTimeout(() => setDropdownOpen(p => ({ ...p, factory: false })), 150)}
                                                onChange={(e) => { mkSet("factory_name", e.target.value); setDropdownOpen(p => ({ ...p, factory: true })); }}
                                                onKeyDown={(e) => {
                                                    if (!dropdownOpen.factory || getFilteredSuggestions("factory", truckForm.factory_name || "").length === 0) return;
                                                    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx(p => ({ ...p, factory: Math.min(p.factory + 1, getFilteredSuggestions("factory", truckForm.factory_name || "").length - 1) })); }
                                                    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx(p => ({ ...p, factory: Math.max(p.factory - 1, 0) })); }
                                                    else if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        const suggestions = getFilteredSuggestions("factory", truckForm.factory_name || "");
                                                        const sel = highlightedIdx.factory >= 0 ? suggestions[highlightedIdx.factory] : suggestions[0];
                                                        if (sel) {
                                                            setTruckField(truckIdx, "factory_name", sel.factory_name);
                                                            if (sel.vehicle_no) setTruckField(truckIdx, "vehicle_no", sel.vehicle_no);
                                                            if (sel.driver_name) setTruckField(truckIdx, "driver_name", sel.driver_name);
                                                            setDropdownOpen(p => ({ ...p, factory: false }));
                                                        }
                                                    } else if (e.key === "Escape") setDropdownOpen(p => ({ ...p, factory: false }));
                                                }}
                                                placeholder={t('tankDispatch.factoryPlaceholder')}
                                                className="w-36 sm:w-44 pr-7"
                                            />
                                            {isActive && dropdownOpen.factory && getFilteredSuggestions("factory", truckForm.factory_name || "").length > 0 && (
                                                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden" style={{ zIndex: 9999 }}>
                                                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">{t('tankDispatch.recentFactories')}</p>
                                                    {getFilteredSuggestions("factory", truckForm.factory_name || "").map((v, idx) => (
                                                        <button key={v.factory_name} type="button"
                                                            onMouseEnter={() => setHighlightedIdx(p => ({ ...p, factory: idx }))}
                                                            onClick={() => {
                                                                setTruckField(truckIdx, "factory_name", v.factory_name);
                                                                if (v.vehicle_no) setTruckField(truckIdx, "vehicle_no", v.vehicle_no);
                                                                if (v.driver_name) setTruckField(truckIdx, "driver_name", v.driver_name);
                                                                setDropdownOpen(p => ({ ...p, factory: false }));
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-xs transition ${highlightedIdx.factory === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                            <div className="font-medium text-gray-800">{v.factory_name}</div>
                                                            {(v.vehicle_no || v.driver_name) && (
                                                                <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                                                                    {v.vehicle_no}{v.vehicle_no && v.driver_name ? " · " : ""}{v.driver_name}
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {truckForm.factory_name && (
                                                <button type="button" onClick={() => mkSet("factory_name", "")}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>
                                            )}
                                        </div>
                                    </Field>

                                    <Field label={t('tankDispatch.vehicleNo')} icon={<Hash size={12} />}>
                                        <div className="relative">
                                            <TinyInput value={truckForm.vehicle_no || ""}
                                                onFocus={() => { setActiveTruckIdx(truckIdx); setDropdownOpen(p => ({ ...p, vehicle: true })); }}
                                                onBlur={() => setTimeout(() => setDropdownOpen(p => ({ ...p, vehicle: false })), 150)}
                                                onChange={(e) => { mkSet("vehicle_no", e.target.value); setDropdownOpen(p => ({ ...p, vehicle: true })); }}
                                                placeholder={t('tankDispatch.vehiclePlaceholder')}
                                                className="w-28 sm:w-32 bg-blue-50 border-blue-200 text-blue-700 pr-7" />
                                            {isActive && dropdownOpen.vehicle && getFilteredSuggestions("vehicle", truckForm.vehicle_no || "").length > 0 && (
                                                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">{t('tankDispatch.vehicles')}</p>
                                                    {getFilteredSuggestions("vehicle", truckForm.vehicle_no || "").map((v) => (
                                                        <button key={v} type="button" onClick={() => { mkSet("vehicle_no", v); setDropdownOpen(p => ({ ...p, vehicle: false })); }}
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-mono transition">{v}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {truckForm.vehicle_no && <button type="button" onClick={() => mkSet("vehicle_no", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>}
                                        </div>
                                    </Field>

                                    <Field label={t('tankDispatch.driver')} icon={<User size={12} />}>
                                        <div className="relative">
                                            <TinyInput value={truckForm.driver_name || ""}
                                                onFocus={() => { setActiveTruckIdx(truckIdx); setDropdownOpen(p => ({ ...p, driver: true })); }}
                                                onBlur={() => setTimeout(() => setDropdownOpen(p => ({ ...p, driver: false })), 150)}
                                                onChange={(e) => { mkSet("driver_name", e.target.value); setDropdownOpen(p => ({ ...p, driver: true })); }}
                                                placeholder={t('tankDispatch.driverPlaceholder')} className="w-28 sm:w-32 pr-7" />
                                            {isActive && dropdownOpen.driver && getFilteredSuggestions("driver", truckForm.driver_name || "").length > 0 && (
                                                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">{t('tankDispatch.drivers')}</p>
                                                    {getFilteredSuggestions("driver", truckForm.driver_name || "").map((v) => (
                                                        <button key={v} type="button" onClick={() => { mkSet("driver_name", v); setDropdownOpen(p => ({ ...p, driver: false })); }}
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition">{v}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {truckForm.driver_name && <button type="button" onClick={() => mkSet("driver_name", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={12} /></button>}
                                        </div>
                                    </Field>

                                    <Field label={t('tankDispatch.remarks')} icon={<ChevronDown size={12} />}>
                                        <TinyInput value={truckForm.remarks || ""} onChange={(e) => mkSet("remarks", e.target.value)}
                                            placeholder={t('tankDispatch.remarksPlaceholder')} className="w-28 sm:w-36" />
                                    </Field>
                                </div>

                                {/* Cow + Buffalo side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Cow */}
                                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t('tankDispatch.cow')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <Field label={t('tankDispatch.qtyL')} icon={<Milk size={12} />}>
                                                <TinyInput type="number" step="0.1"
                                                    value={truckForm.cow_qty !== undefined && truckForm.cow_qty !== "" ? truckForm.cow_qty : cowQtyDefault}
                                                    onChange={(e) => mkSet("cow_qty", e.target.value)}
                                                    placeholder="0.0"
                                                    className="w-20 bg-amber-50 border-amber-200 text-amber-800 font-bold" />
                                            </Field>
                                            <Field label={t('tankDispatch.ratePerL')} icon={<TrendingUp size={12} />}>
                                                <TinyInput value={truckForm.cow_rate || ""}
                                                    onChange={(e) => mkSet("cow_rate", e.target.value)}
                                                    placeholder="₹0.00" type="number" step="0.01"
                                                    className="w-20 bg-amber-50 border-amber-200 text-amber-700" />
                                            </Field>
                                            {stock?.avg_fat_cow && (
                                                <Field label="FAT%" icon={<FlaskConical size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-amber-100 border border-amber-200 text-amber-700 font-bold text-sm w-14">
                                                        {parseFloat(stock.avg_fat_cow).toFixed(2)}
                                                    </div>
                                                </Field>
                                            )}
                                            {stock?.avg_snf_cow && (
                                                <Field label="SNF%" icon={<FlaskConical size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-amber-100 border border-amber-200 text-amber-700 font-bold text-sm w-14">
                                                        {parseFloat(stock.avg_snf_cow).toFixed(2)}
                                                    </div>
                                                </Field>
                                            )}
                                            {cowAmt && (
                                                <Field label={t('tankDispatch.amount')} icon={<TrendingUp size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm whitespace-nowrap">
                                                        ₹{cowAmt}
                                                    </div>
                                                </Field>
                                            )}
                                        </div>
                                    </div>

                                    {/* Buffalo */}
                                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{t('tankDispatch.buffalo')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <Field label={t('tankDispatch.qtyL')} icon={<Milk size={12} />}>
                                                <TinyInput type="number" step="0.1"
                                                    value={truckForm.buffalo_qty !== undefined && truckForm.buffalo_qty !== "" ? truckForm.buffalo_qty : bufQtyDefault}
                                                    onChange={(e) => mkSet("buffalo_qty", e.target.value)}
                                                    placeholder="0.0"
                                                    className="w-20 bg-blue-50 border-blue-200 text-blue-800 font-bold" />
                                            </Field>
                                            <Field label={t('tankDispatch.ratePerL')} icon={<TrendingUp size={12} />}>
                                                <TinyInput value={truckForm.buffalo_rate || ""}
                                                    onChange={(e) => mkSet("buffalo_rate", e.target.value)}
                                                    placeholder="₹0.00" type="number" step="0.01"
                                                    className="w-20 bg-blue-50 border-blue-200 text-blue-700" />
                                            </Field>
                                            {stock?.avg_fat_buffalo && (
                                                <Field label="FAT%" icon={<FlaskConical size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-blue-100 border border-blue-200 text-blue-700 font-bold text-sm w-14">
                                                        {parseFloat(stock.avg_fat_buffalo).toFixed(2)}
                                                    </div>
                                                </Field>
                                            )}
                                            {stock?.avg_snf_buffalo && (
                                                <Field label="SNF%" icon={<FlaskConical size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-blue-100 border border-blue-200 text-blue-700 font-bold text-sm w-14">
                                                        {parseFloat(stock.avg_snf_buffalo).toFixed(2)}
                                                    </div>
                                                </Field>
                                            )}
                                            {bufAmt && (
                                                <Field label={t('tankDispatch.amount')} icon={<TrendingUp size={12} />}>
                                                    <div className="h-[35px] px-3 flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm whitespace-nowrap">
                                                        ₹{bufAmt}
                                                    </div>
                                                </Field>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Truck button */}
                    {!editingDispatch && (
                        <button type="button"
                            onClick={() => {
                                setTrucks(p => [...p, { ...EMPTY_TRUCK }]);
                                setActiveTruckIdx(trucks.length);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-900 hover:text-gray-900 text-xs font-semibold transition w-full justify-center mb-4">
                            <Plus size={13} /> {t('tankDispatch.addAnotherTruck')}
                        </button>
                    )}

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            {dispatches.length} {dispatches.length === 1 ? t('tankDispatch.dispatch') : t('tankDispatch.dispatches')} {t('tankDispatch.on')}{" "}
                            {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {totalDispatched > 0 && <span className="ml-2 text-gray-600 font-semibold">· {totalDispatched.toFixed(1)} L {t('tankDispatch.total')}</span>}
                        </p>
                        <button type="button"
                            onClick={editingDispatch ? handleUpdate : handleSave}
                            disabled={saving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                ${saving ? "bg-gray-300 cursor-not-allowed"
                                    : editingDispatch ? "bg-amber-600 hover:bg-amber-700 active:scale-95"
                                        : "bg-black hover:bg-gray-800 active:scale-95"}`}>
                            <Save size={15} />
                            {saving ? (editingDispatch ? t('tankDispatch.updating') : t('tankDispatch.saving'))
                                : editingDispatch ? t('tankDispatch.updateDispatch')
                                    : `${t('tankDispatch.record')} ${trucks.length > 1 ? trucks.length + " " + t('tankDispatch.trucks') : t('tankDispatch.dispatch')}`}
                        </button>
                    </div>
                </div>

                {/* Dispatch History Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="dispatch-table">
                    {/* Header */}
                    <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : dispatches.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Truck size={32} />
                            <p className="text-sm">{t('tankDispatch.noDispatches')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {[...dispatches].reverse().map((d, i) => (
                                    <div key={d.dispatch_id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                                                    <Truck size={11} className="text-white" />
                                                </div>
                                                <span className="text-gray-800 font-medium text-xs truncate">{d.factory_name || "—"}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
                                                ${d.milk_type === "cow" ? "bg-amber-50 text-amber-700 border-amber-100"
                                                    : d.milk_type === "buffalo" ? "bg-blue-50 text-blue-700 border-blue-100"
                                                        : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                                {d.milk_type === "cow" ? t('tankDispatch.cow') : t('tankDispatch.buffalo')}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-blue-600 font-mono text-xs font-medium">{d.vehicle_no || "—"}</TableCell>
                                        <TableCell className="text-gray-600 text-xs">{d.driver_name || "—"}</TableCell>
                                        <TableCell className="text-emerald-600 font-mono font-bold text-xs">
                                            {parseFloat(d.total_liters).toFixed(1)} L
                                        </TableCell>
                                        <TableCell className="text-amber-600 font-mono text-xs">
                                            {d.avg_fat ? parseFloat(d.avg_fat).toFixed(2) + "%" : "—"}
                                        </TableCell>
                                        <TableCell className="text-violet-600 font-mono text-xs">
                                            {d.avg_snf ? parseFloat(d.avg_snf).toFixed(2) + "%" : "—"}
                                        </TableCell>
                                        <TableCell className="text-gray-700 font-mono text-xs">
                                            {d.factory_rate ? `₹${parseFloat(d.factory_rate).toFixed(2)}` : "—"}
                                        </TableCell>
                                        <TableCell className="text-gray-900 font-bold text-xs">
                                            ₹{parseFloat(d.total_amount || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-gray-400 text-xs truncate">
                                            {d.remarks || "—"}
                                        </TableCell>
                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(d.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={(e) => printChallan(e, d)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-semibold transition">
                                                <Truck size={10} /> PDF
                                            </button>
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell>
                                                <button
                                                    onClick={() => handleEdit(d)}
                                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border
                                                        ${editingDispatch?.dispatch_id === d.dispatch_id
                                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                                            : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"}`}>
                                                    ✏ {editingDispatch?.dispatch_id === d.dispatch_id ? t('tankDispatch.editing') : t('tankDispatch.edit')}
                                                </button>
                                            </TableCell>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals footer */}
                    {dispatches.length > 0 && (
                        <div className="grid border-t-2 border-gray-100 bg-gray-50/80"
                            style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {dispatches.length} {dispatches.length === 1 ? t('tankDispatch.dispatch') : t('tankDispatch.dispatches')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-emerald-600 border-r border-gray-100">
                                {totalDispatched.toFixed(1)} L
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-100">
                                ₹{totalFactoryRev.toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5" />
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• {t('tankDispatch.legendRemaining')}</span>
                    <span>• {t('tankDispatch.legendClickStock')}</span>
                    <span>• {t('tankDispatch.legendFatSnf')}</span>
                </div>
            </main>
        </div>
    );
}