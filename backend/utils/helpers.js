// utils/helpers.js
export const today = () => new Date().toISOString().split("T")[0];

export const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const fmtTime = (d) =>
    d
        ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "—";

export const getDateRange = (dateStr, period) => {
    const date = new Date(dateStr);
    let from, to;

    switch (period) {
        case 'day':
            from = to = dateStr;
            break;
        case 'week':
            const dayOfWeek = date.getDay();
            const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(date);
            monday.setDate(diff);
            from = monday.toISOString().split('T')[0];
            const sunday = new Date(monday);
            sunday.setDate(diff + 6);
            to = sunday.toISOString().split('T')[0];
            break;
        case 'month':
            from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            break;
        case 'year':
            from = `${date.getFullYear()}-01-01`;
            to = `${date.getFullYear()}-12-31`;
            break;
        default:
            from = to = dateStr;
    }
    return { from, to };
};

export const formatPeriodLabel = (period, from, to) => {
    if (period === 'day') return new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (period === 'week') {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return `${fromDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (period === 'month') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (period === 'year') return new Date(from).getFullYear();
    return '';
};