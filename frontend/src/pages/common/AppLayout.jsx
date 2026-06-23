// src/pages/common/AppLayout.jsx
import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';        // ← react-i18next
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../context/AppConfigContext';
import {
    LayoutDashboard, HardHat, Users, BarChart2, Star,
    Milk, Package, Wallet, Truck, ClipboardList,
    ShoppingCart, Home, LogOut, ChevronLeft, ChevronRight,
    Menu, Building2, ShoppingBag, Archive,
    Users2, Settings,
    User2Icon, 
} from 'lucide-react';

/**
 * SHARED_NAV is a function so it re-evaluates whenever `t` or `isAdmin`
 * changes — this means nav labels update instantly when language switches.
 */
const SHARED_NAV = (isAdmin, t) => [
    {
        label: t('nav.dashboard'),
        icon: <LayoutDashboard size={16} />,
        to: isAdmin ? '/admin/dashboard' : '/operator/dashboard',
    },
    ...(isAdmin ? [
        { label: t('nav.operators'), icon: <HardHat size={16} />, to: '/admin/operators/new' },
        { label: t('nav.operatorList'), icon: <HardHat size={16} />, to: '/admin/operatorlist' },
        { label: t('nav.settings'), icon: <Settings size={16} />, to: '/admin/settings' },
        { label: t('nav.premiumRates'), icon: <Star size={16} />, to: '/admin/premiumrates' },
        { label: t('nav.adminList'), icon: <User2Icon size={16} />, to: '/admin/adminlist' },

    ] : []),
    { label: t('nav.sellers'), icon: <Users size={16} />, to: '/sellerregister' },
    { label: t('nav.sellerPayments'), icon: <Users2 size={14} />, to: '/sellerpayments' },
    { label: t('nav.rateChart'), icon: <BarChart2 size={16} />, to: '/rates' },
    { label: t('nav.milkEntry'), icon: <Milk size={16} />, to: '/milkentries' },
    { label: t('nav.walkinSale'), icon: <ShoppingCart size={16} />, to: '/walkinsales' },
    { label: t('nav.walkinPayments'), icon: <ShoppingCart size={16} />, to: '/walkinpayments' },
    { label: t('nav.namedBuyers'), icon: <User2Icon size={16} />, to: '/namedbuyers'},
    {
        label: t('nav.products'),
        icon: <Package size={16} />,
        to: null,
        children: [
            { label: t('nav.catalogue'), icon: <Archive size={14} />, to: '/products' },
            { label: t('nav.purchase'), icon: <ShoppingBag size={14} />, to: '/productpurchase' },
            { label: t('nav.sales'), icon: <ShoppingCart size={14} />, to: '/productsales' },
        ],
    },
    {
        label: t('nav.bonusRegister'),
        icon: <Star size={16} />,
        to: null,
        children: [
            { label: t('nav.utpadakBonus'), icon: <Star size={14} />, to: '/utpadakbonusregister' },
            { label: t('nav.gavaliBonus'), icon: <Star size={14} />, to: '/gavalibonusregister' },
        ],
    },
    { label: t('nav.cashAdvance'), icon: <Wallet size={16} />, to: '/cashadvance' },
    { label: t('nav.cashDeposit'), icon: <Wallet size={16} />, to: '/cashdeposit' },
    { label: t('nav.tankDispatch'), icon: <Truck size={16} />, to: '/tankdispatch' },
    { label: t('nav.sumReport'), icon: <ClipboardList size={16} />, to: '/sumreport' },
    { label: t('nav.ownerUsage'), icon: <Home size={16} />, to: '/ownerusage' },
    { label: 'Clear All Data', icon: <Settings size={16} />, to: '/admin/clear-data', adminOnly: true },
];

const initials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const ToggleBtn = ({ collapsed, onClick, isAdmin }) => (
    <button
        onClick={onClick}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`absolute -right-3.5 top-7 z-30 w-7 h-7 rounded-full border-2 flex items-center justify-center
            shadow-md transition-all duration-200
            ${isAdmin
                ? 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
            }`}
    >
        {collapsed
            ? <ChevronRight size={13} strokeWidth={2.5} />
            : <ChevronLeft size={13} strokeWidth={2.5} />}
    </button>
);

function SidebarContent({ mobile = false, collapsed, expanded, setExpanded, navItems, isAdmin, user, handleLogout, appName, logoUrl }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full">

            {/* Logo / App Identity */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b ${isAdmin ? 'border-gray-800' : 'border-emerald-700'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md overflow-hidden
                    ${isAdmin ? 'bg-white text-gray-900' : 'bg-white text-emerald-700'}`}>
                    {logoUrl
                        ? <img src={logoUrl} alt={appName} className="w-full h-full object-contain p-0.5" />
                        : <Building2 size={18} strokeWidth={2} />
                    }
                </div>
                {(!collapsed || mobile) && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white leading-tight whitespace-nowrap tracking-tight">
                            {appName}
                        </p>
                        <p className={`text-[11px] mt-0.5 whitespace-nowrap font-medium
                            ${isAdmin ? 'text-gray-500' : 'text-emerald-400'}`}>
                            {isAdmin ? t('adminPortal') : t('operatorPortal')}
                        </p>
                    </div>
                )}
            </div>

            {/* Nav Items */}
            <nav className={`sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1`}>
                {navItems.map(item =>
                    item.children ? (
                        <div key={item.label}>
                            <button
                                onClick={() => setExpanded(p => ({ ...p, [item.label]: !p[item.label] }))}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150
                                    ${isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'}`}
                            >
                                <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                                {(!collapsed || mobile) && (
                                    <>
                                        <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                                        <ChevronRight size={13}
                                            className={`transition-transform duration-200 ${expanded[item.label] ? 'rotate-90' : ''}`} />
                                    </>
                                )}
                            </button>

                            {(expanded[item.label] && (!collapsed || mobile)) && (
                                <div className={`ml-4 mt-0.5 space-y-0.5 border-l-2 pl-3 border-opacity-40 border-dashed
                                    ${isAdmin ? 'border-gray-600' : 'border-emerald-500'}`}>
                                    {item.children.map(child => (
                                        <NavLink
                                            key={child.to}
                                            to={child.to}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 relative
                                                before:absolute before:-left-[13px] before:top-1/2 before:-translate-y-1/2 before:w-2.5 before:h-px
                                                ${isAdmin ? 'before:bg-gray-600' : 'before:bg-emerald-500'}
                                                ${isActive
                                                    ? isAdmin ? 'bg-white text-gray-900 font-semibold' : 'bg-white text-emerald-700 font-semibold'
                                                    : isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'
                                                }`
                                            }
                                        >
                                            <span className="shrink-0">{child.icon}</span>
                                            <span className="whitespace-nowrap">{child.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={collapsed && !mobile ? item.label : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group relative
                                ${isActive
                                    ? isAdmin ? 'bg-white text-gray-900 font-semibold shadow-sm' : 'bg-white text-emerald-700 font-semibold shadow-sm'
                                    : isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'
                                }`
                            }
                        >
                            <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                            {(!collapsed || mobile) && (
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                            )}
                            {collapsed && !mobile && (
                                <span className={`absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap
                                    pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg
                                    ${isAdmin ? 'bg-gray-900 text-white' : 'bg-emerald-900 text-white'}`}>
                                    {item.label}
                                </span>
                            )}
                        </NavLink>
                    )
                )}
            </nav> 

            {/* Bottom Avatar */}
            <div className={`border-t p-3 ${isAdmin ? 'border-gray-800' : 'border-emerald-700'}`}>
                <div className={`flex items-center gap-3 px-2 py-2 rounded-xl transition cursor-default
                    ${isAdmin ? 'hover:bg-gray-800' : 'hover:bg-emerald-700'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${isAdmin ? 'bg-gray-600 text-white' : 'bg-emerald-300 text-emerald-900'}`}>
                        {initials(user?.name)}
                    </div>
                    {(!collapsed || mobile) && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-none">{user?.name}</p>
                            <p className={`text-xs mt-0.5 capitalize ${isAdmin ? 'text-gray-400' : 'text-emerald-300'}`}>
                                {user?.role === 'admin' ? t('status.admin') : t('status.operator')}
                            </p>
                        </div>
                    )}
                    {(!collapsed || mobile) && (
                        <button onClick={handleLogout} title={t('actions.logout')}
                            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition
                                ${isAdmin
                                    ? 'text-gray-400 hover:bg-gray-700 hover:text-rose-400'
                                    : 'text-emerald-300 hover:bg-emerald-600 hover:text-rose-300'}`}>
                            <LogOut size={14} />
                        </button>
                    )}
                </div>
                {collapsed && !mobile && (
                    <button onClick={handleLogout} title={t('actions.logout')}
                        className={`mt-1 w-full flex items-center justify-center py-2 rounded-xl transition
                            ${isAdmin
                                ? 'text-gray-400 hover:bg-gray-800 hover:text-rose-400'
                                : 'text-emerald-300 hover:bg-emerald-700 hover:text-rose-300'}`}>
                        <LogOut size={15} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function AppLayout() {
    const { user, logout } = useAuth();
    const { appName, logoUrl } = useAppConfig();   // ← global app identity
    const { t } = useTranslation();                // ← i18next
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = user?.role === 'admin';

    const [collapsed, setCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expanded, setExpanded] = useState({ [t('nav.products')]: true });

    // Re-build nav whenever language (t) or role changes
    const navItems = useMemo(() => SHARED_NAV(isAdmin, t), [isAdmin, t]);

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate(isAdmin ? '/' : '/operator/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[#f5f4f0]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
                .sidebar-scroll::-webkit-scrollbar { width: 3px; }
                .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
                .sidebar-scroll::-webkit-scrollbar-thumb { border-radius: 10px; background: rgba(255,255,255,0.12); }
                .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
            `}</style>

            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setMobileOpen(false)} />
            )}

            {/* Mobile sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-300 lg:hidden
                ${isAdmin ? 'bg-gray-900' : 'bg-emerald-800'}
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent mobile
                    collapsed={collapsed} expanded={expanded} setExpanded={setExpanded}
                    navItems={navItems} isAdmin={isAdmin} user={user} handleLogout={handleLogout}
                    appName={appName} logoUrl={logoUrl}
                />
            </aside>

            {/* Desktop sidebar */}
            <aside className={`relative hidden lg:flex flex-col shrink-0 transition-all duration-300
                ${collapsed ? 'w-[68px]' : 'w-56'}
                ${isAdmin ? 'bg-gray-900' : 'bg-emerald-800'}`}>
                <ToggleBtn collapsed={collapsed} onClick={() => setCollapsed(p => !p)} isAdmin={isAdmin} />
                <SidebarContent
                    collapsed={collapsed} expanded={expanded} setExpanded={setExpanded}
                    navItems={navItems} isAdmin={isAdmin} user={user} handleLogout={handleLogout}
                    appName={appName} logoUrl={logoUrl}
                />
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile top bar */}
                <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-white border-gray-200">
                    <button onClick={() => setMobileOpen(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-600">
                        <Menu size={16} />
                    </button>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden
                        ${isAdmin ? 'bg-gray-100 text-white' : 'bg-gray-100 text-white'}`}>
                        {logoUrl
                            ? <img src={logoUrl} alt={appName} className="w-full h-full object-contain p-0.5" />
                            : <Building2 size={14} />
                        }
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{appName}</span>
                    <div className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                        ${isAdmin ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {initials(user?.name)}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto tracking-tighter">
                    <Outlet />
                </main>
            </div>
            {
                showLogoutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-2xl shadow-xl px-6 py-5 w-80 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                    <LogOut size={16} className="text-rose-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Confirm Logout</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Are you sure you want to log out?</p>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => setShowLogoutConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button onClick={confirmLogout}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition">
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    ); 
}