// src/pages/common/AppLayout.jsx
import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../context/AppConfigContext';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import api from '../../api/axios';
import {
    LayoutDashboard, HardHat, Users, BarChart2, Star,
    Milk, Package, Wallet, Truck, ClipboardList,
    ShoppingCart, Home, LogOut, ChevronLeft, ChevronRight,
    Menu, Building2, ShoppingBag, Archive,
    Users2, Settings,
    User2Icon,
    HdmiPort,
    Wheat,
    FileText,
    BanknoteArrowDown,
    HandCoins,
    ArrowLeftRight,
    ShoppingBasket,
    Percent,
    UserCircle, Droplets, User
} from 'lucide-react';

/**
 * SHARED_NAV - All pages that are common between Admin and Operator.
 * Individual pages like Settings and Profile have role-specific routes.
 * Visibility is controlled via the Page Visibility settings in Admin Settings.
 */
const SHARED_NAV = (isAdmin, t) => {
    const getRoute = (path) => (isAdmin ? `/admin${path}` : `/operator${path}`);
    const getPageKey = (key) => (isAdmin ? `admin_${key}` : `operator_${key}`);

    const nav = [
        {
            label: t('nav.dashboard'),
            icon: <LayoutDashboard size={16} />,
            to: getRoute('/dashboard'),
            tourId: 'nav-dashboard',
            pageKey: getPageKey('dashboard'),
        },
        {
            label: t('nav.myProfile', { defaultValue: 'My Profile' }),
            icon: <UserCircle size={16} />,
            to: getRoute('/profile'),
            tourId: 'nav-my-profile',
            pageKey: getPageKey('profile'),
        },
        {
            label: t('nav.settings'),
            icon: <Settings size={16} />,
            to: getRoute('/settings'),
            tourId: 'nav-settings',
            pageKey: getPageKey('settings'),
        },

        ...(isAdmin ? [
            {
                label: t('nav.administration'),
                icon: <Settings size={16} />,
                to: null,
                tourId: 'nav-administration',
                children: [
                    { label: t('nav.settings'), icon: <Settings size={14} />, to: '/admin/settings', pageKey: 'admin_settings' },
                    { label: t('nav.centres', { defaultValue: 'Centres' }), icon: <Building2 size={14} />, to: '/admin/centres', pageKey: 'admin_centres' },
                    { label: t('nav.premiumRates'), icon: <Star size={14} />, to: '/admin/premiumrates', pageKey: 'admin_premium_rates' },
                    { label: t('nav.operators'), icon: <HardHat size={14} />, to: '/admin/operators/new', pageKey: 'admin_operators' },
                    { label: t('nav.operatorList'), icon: <HardHat size={14} />, to: '/admin/operatorlist', pageKey: 'admin_operators' },
                    { label: t('nav.adminList'), icon: <User2Icon size={14} />, to: '/admin/adminlist', pageKey: 'admin_admin_list' },
                    { label: t('nav.portSettings'), icon: <HdmiPort size={14} />, to: '/admin/ports', pageKey: 'admin_port_settings' },
                    { label: t('nav.commissionSettings', { defaultValue: 'Commission Settings' }), icon: <Percent size={14} />, to: '/commission-settings', pageKey: 'admin_commission_settings' },
                    { label: 'Clear All Data', icon: <Settings size={14} />, to: '/admin/clear-data', pageKey: 'admin_clear_data' },
                ],
            },
        ] : []),

        {
            label: t('nav.sellers'),
            icon: <Users size={16} />,
            to: null,
            tourId: 'nav-sellers',
            children: [
                { label: t('nav.sellers'), icon: <Users size={14} />, to: '/sellerregister', pageKey: getPageKey('seller_register') },
                { label: t('nav.rateChart'), icon: <BarChart2 size={14} />, to: '/rates', pageKey: getPageKey('rate_chart') },
                { label: t('nav.sellerPayments'), icon: <Users2 size={14} />, to: '/sellerpayments', pageKey: getPageKey('seller_payments') },
            ],
        },

        {
            label: t('nav.milkCollection'),
            icon: <Milk size={16} />,
            to: null,
            tourId: 'nav-milk-collection',
            children: [
                { label: t('nav.milkEntry'), icon: <Milk size={14} />, to: '/milkentries', pageKey: getPageKey('milk_entry') },
                { label: t('nav.utpadakMilkEntry', { defaultValue: 'Utpadak Milk Entry' }), icon: <Milk size={14} />, to: '/utpadak-milk-entry', pageKey: getPageKey('utpadak_milk_entry') },
                { label: t('nav.gavaliMilkEntry', { defaultValue: 'Gavali Milk Entry' }), icon: <Milk size={14} />, to: '/gavali-milk-entry', pageKey: getPageKey('gavali_milk_entry') },
                { label: t('nav.ownerUsage'), icon: <Home size={14} />, to: '/ownerusage', pageKey: getPageKey('owner_usage') },
                { label: t('nav.tankDispatch'), icon: <Truck size={14} />, to: '/tankdispatch', pageKey: getPageKey('tank_dispatch') },
                ...(isAdmin ? [
                    { label: t('nav.allMilkEntries', { defaultValue: 'All Milk Entries' }), icon: <ClipboardList size={14} />, to: '/all-milk-entries', pageKey: 'admin_all_milk_entries' }
                ] : []),
            ],
        },

        {
            label: t('nav.walkinSales'),
            icon: <ShoppingCart size={16} />,
            to: null,
            tourId: 'nav-walkin-sales',
            children: [
                { label: t('nav.walkinSale'), icon: <ShoppingCart size={14} />, to: '/walkinsales', pageKey: getPageKey('walkin_sales') },
                { label: t('nav.walkinPayments'), icon: <ShoppingCart size={14} />, to: '/walkinpayments', pageKey: getPageKey('walkin_payments') },
                { label: t('nav.namedBuyers'), icon: <User2Icon size={14} />, to: '/namedbuyers', pageKey: getPageKey('named_buyers') },
                ...(isAdmin ? [
                    { label: t('nav.sellerReport'), icon: <Users2 size={14} />, to: '/walkinsellersreport', pageKey: 'admin_walkin_seller_report' },
                    { label: t('nav.namedBuyerReports'), icon: <User2Icon size={14} />, to: '/walkinnamedbuyersreports', pageKey: 'admin_walkin_named_buyer_reports' },
                    { label: t('nav.anonReports'), icon: <FileText size={14} />, to: '/walkinanonymousreports', pageKey: 'admin_walkin_anon_reports' },
                ] : []),
            ],
        },

        {
            label: t('nav.products'),
            icon: <Package size={16} />,
            to: null,
            tourId: 'nav-products',
            children: [
                { label: t('nav.catalogue'), icon: <Archive size={14} />, to: '/products', pageKey: getPageKey('products') },
                { label: t('nav.purchase'), icon: <ShoppingBag size={14} />, to: '/productpurchase', pageKey: getPageKey('product_purchases') },
                { label: t('nav.sales'), icon: <ShoppingCart size={14} />, to: '/productsales', pageKey: getPageKey('product_sales') },
                ...(isAdmin ? [
                    { label: t('nav.productPurchasePayment'), icon: <ShoppingBasket size={16} />, to: '/product-purchase-payments', pageKey: 'admin_product_purchase_payment' },
                    { label: t('nav.productSalesReport', { defaultValue: 'Product Sales Report' }), icon: <BarChart2 size={14} />, to: '/product-sales/report', pageKey: 'admin_product_sales_report' },
                ] : []),
            ],
        },

        {
            label: t('nav.cattleFeed'),
            icon: <Package size={16} />,
            to: null,
            tourId: 'nav-cattle-feed',
            children: [
                { label: t('nav.catalogue'), icon: <Archive size={14} />, to: '/cattlefeed-catalogue', pageKey: getPageKey('cattle_feed_catalogue') },
                { label: t('nav.purchase'), icon: <ShoppingBag size={14} />, to: '/cattlefeed-purchase', pageKey: getPageKey('cattle_feed_purchase') },
                { label: t('nav.sales'), icon: <ShoppingCart size={14} />, to: '/cattlefeed-sales', pageKey: getPageKey('cattle_feed_sales') },
                ...(isAdmin ? [
                    { label: t('nav.cattlefeedPurchasePayment'), icon: <Wheat size={16} />, to: '/cattlefeed-purchase-payments', pageKey: 'admin_cattle_feed_purchase_payment' },
                    { label: t('nav.cattleFeedSalesReport', { defaultValue: 'Cattle Feed Sales Report' }), icon: <BarChart2 size={14} />, to: '/cattle-feed-sales/report', pageKey: 'admin_cattle_feed_sales_report' },
                ] : []),
            ],
        },

        {
            label: t('nav.finance'),
            icon: <Wallet size={16} />,
            to: null,
            tourId: 'nav-finance',
            children: [
                { label: t('nav.cashAdvance'), icon: <Wallet size={14} />, to: '/cashadvance', pageKey: getPageKey('cash_advance') },
                { label: t('nav.cashDeposit'), icon: <Wallet size={14} />, to: '/cashdeposit', pageKey: getPageKey('cash_deposit') },
            ],
        },

        {
            label: t('nav.bonusRegister'),
            icon: <Star size={16} />,
            to: null,
            tourId: 'nav-bonus-register',
            children: [
                { label: t('nav.utpadakBonus'), icon: <Star size={14} />, to: '/utpadakbonusregister', pageKey: getPageKey('utpadak_bonus_register') },
                { label: t('nav.gavaliBonus'), icon: <Star size={14} />, to: '/gavalibonusregister', pageKey: getPageKey('gavali_bonus_register') },
            ],
        },

        { label: t('nav.sumReport'), icon: <ClipboardList size={16} />, to: '/sumreport', tourId: 'nav-sum-report', pageKey: getPageKey('sum_report') },

        ...(isAdmin ? [
            { label: t('nav.farmerLedger'), icon: <ArrowLeftRight size={16} />, to: '/farmer-ledger', tourId: 'nav-farmer-ledger', pageKey: 'admin_farmer_ledger' }
        ] : []),

        ...(isAdmin ? [
            {
                label: t('nav.expenses'),
                icon: <HandCoins size={16} />,
                to: null,
                tourId: 'nav-expenses',
                children: [
                    { label: t('nav.expenses'), icon: <BanknoteArrowDown size={16} />, to: '/expenses', pageKey: 'admin_expenses' },
                    { label: t('nav.expensesReport'), icon: <HandCoins size={16} />, to: '/expensesreport', pageKey: 'admin_expenses_report' },
                ]
            }
        ] : []),

        {
            label: t('nav.premiumRates'),
            icon: <Star size={16} />,
            to: '/admin/premiumrates',
            tourId: 'nav-premium-rates',
            pageKey: getPageKey('premium_rates'),
        },

        {
            label: t('nav.bonusReports', { defaultValue: 'Bonus Reports' }),
            icon: <FileText size={16} />,
            to: null,
            tourId: 'nav-bonus-reports',
            children: [
                { label: t('nav.utpadakBonusReport'), icon: <FileText size={14} />, to: '/utpadakbonusreport', pageKey: getPageKey('utpadak_bonus_report') },
                { label: t('nav.gavaliBonusReport'), icon: <FileText size={14} />, to: '/gavalibonusreport', pageKey: getPageKey('gavali_bonus_report') },
            ],
        },
        // NOTE: the separate "Walk-in Reports" admin section was a duplicate of the
        // report links already added under Walk-in Sales above (with the same
        // /admin-prefixed bug) — removed rather than fixed, to avoid two nav
        // entries pointing at the same three pages.
    ];

    return nav;
};

/**
 * FARMER_NAV - Farmer only sees their own records.
 * Settings and Profile are separate for Farmer.
 */
const FARMER_NAV = (t) => [
    {
        label: t('nav.dashboard', { defaultValue: 'Dashboard' }),
        icon: <LayoutDashboard size={16} />,
        to: '/farmer/dashboard',
        tourId: 'nav-dashboard',
        pageKey: 'farmer_dashboard',
    },
    {
        label: t('nav.myProfile', { defaultValue: 'My Profile' }),
        icon: <User size={16} />,
        to: '/farmer/profile',
        tourId: 'nav-my-profile',
        pageKey: 'farmer_profile',
    },
    {
        label: t('nav.settings'),
        icon: <Settings size={16} />,
        to: '/farmer/settings',
        tourId: 'nav-settings',
        pageKey: 'farmer_settings',
    },
    {
        label: t('nav.myMilkEntries', { defaultValue: 'My Milk Entries' }),
        icon: <Milk size={16} />,
        to: '/farmer/milk-entries',
        tourId: 'nav-my-milk-entries',
        pageKey: 'farmer_milk_entries',
    },
    {
        label: t('nav.myBills', { defaultValue: 'My Milk Bills' }),
        icon: <ClipboardList size={16} />,
        to: '/farmer/bills',
        tourId: 'nav-my-bills',
        pageKey: 'farmer_bills',
    },
    {
        label: t('nav.myFinance', { defaultValue: 'Advance & Deposit' }),
        icon: <Wallet size={16} />,
        to: '/farmer/finance',
        tourId: 'nav-my-finance',
        pageKey: 'farmer_finance',
    },
    {
        label: t('nav.MyCattleFeed', { defaultValue: 'My Cattle Feed' }),
        icon: <Wheat size={16} />,
        to: '/farmer/cattle-feed',
        tourId: 'nav-my-cattle-feed',
        pageKey: 'farmer_cattle_feed',
    },
    {
        label: t('nav.myProductPurchases', { defaultValue: 'My Product Purchases' }),
        icon: <ShoppingBag size={16} />,
        to: '/farmer/product-purchases',
        tourId: 'nav-my-product-purchases',
        pageKey: 'farmer_product_purchases',
    },
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

function SidebarContent({ mobile = false, collapsed, expanded, setExpanded, navItems, isAdmin, isFarmer, user, handleLogout, appName, logoUrl, navigate, isFavorited, toggleFavorite }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full">

            {/* Logo / App Identity */}
            <div className={`flex items-center gap-3 px-4 py-4 border-b ${isAdmin ? 'border-gray-800' : isFarmer ? 'border-emerald-700' : 'border-emerald-700'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md overflow-hidden
                    ${isAdmin ? 'bg-white text-gray-900' : 'bg-white text-emerald-700'}`}>
                    {logoUrl
                        ? <img src={logoUrl} alt={appName} className="w-full h-full object-contain p-0.5" />
                        : <Droplets size={18} strokeWidth={2} />
                    }
                </div>
                {(!collapsed || mobile) && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white leading-tight whitespace-nowrap tracking-tight">
                            {appName}
                        </p>
                        <p className={`text-[11px] mt-0.5 whitespace-nowrap font-medium
                             ${isAdmin ? 'text-gray-500' : isFarmer ? 'text-emerald-400' : 'text-emerald-400'}`}>
                            {isAdmin
                                ? t('adminPortal')
                                : isFarmer
                                    ? t('farmerPortal', { defaultValue: 'Farmer Portal' })
                                    : t('operatorPortal')}
                        </p>
                    </div>
                )}
            </div>

            {/* Nav Items */}
            <nav className={`sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1`}>
                {navItems.map(item =>
                    item.children ? (
                        <div key={item.label} data-tour={item.tourId} className="group relative">
                            <button
                                onClick={() => setExpanded(p => ({ ...p, [item.label]: !(p[item.label] ?? true) }))}
                                title={collapsed && !mobile ? item.label : undefined}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150
                                    ${isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : isFarmer ? 'text-emerald-200 hover:bg-emerald-700 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'}`}
                            >
                                <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                                {(!collapsed || mobile) && (
                                    <>
                                        <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                                        <ChevronRight size={13}
                                            className={`transition-transform duration-200 ${(expanded[item.label] ?? true) ? 'rotate-90' : ''}`} />
                                    </>
                                )}
                            </button>

                            {((expanded[item.label] ?? true) && (!collapsed || mobile)) && (
                                <div className={`ml-5 mt-0.5 space-y-0.5 pl-4 relative
    before:absolute before:left-0 before:top-0 before:bottom-4 before:w-0.5
    ${isAdmin ? 'before:bg-gray-700' : 'before:bg-emerald-600'}`}>
                                    {item.children.map(child => {
                                        const favActive = isFavorited?.(child.to);
                                        return (
                                            <NavLink
                                                key={child.to}
                                                to={child.to}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 relative
                                                    before:absolute before:-left-[13px] before:top-1/2 before:-translate-y-1/2 before:w-2.5 before:h-px
                                                    ${isAdmin ? 'before:bg-gray-600' : 'before:bg-emerald-500'}
                                                    ${isActive
                                                        ? isAdmin ? 'bg-white/10 text-white font-semibold' : 'bg-white/10 text-white font-semibold'
                                                        : isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'
                                                    }`
                                                }
                                            >
                                                <span className="shrink-0">{child.icon}</span>
                                                <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{child.label}</span>
                                                {toggleFavorite && (
                                                    <span
                                                        role="button"
                                                        onClick={(e) => toggleFavorite(e, child)}
                                                        title={favActive ? 'Remove from favourites' : 'Add to favourites'}
                                                        className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition
                                                            ${isAdmin ? 'text-amber-400 hover:bg-gray-700' : 'text-amber-300 hover:bg-emerald-600'}`}
                                                    >
                                                        <Star size={12} fill={favActive ? 'currentColor' : 'none'} />
                                                    </span>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Hover flyout — the only way to reach a group's children when the
                                sidebar is collapsed (tablet is permanently in this state) */}
                            {collapsed && !mobile && (
                                <div className={`hidden group-hover:flex flex-col absolute left-full top-0 ml-2 min-w-[180px] rounded-xl shadow-xl z-50 py-2 px-1
                                    ${isAdmin ? 'bg-gray-900' : 'bg-emerald-900'}`}>
                                    <span className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${isAdmin ? 'text-gray-500' : 'text-emerald-300'}`}>
                                        {item.label}
                                    </span>
                                    {item.children.map(child => (
                                        <NavLink
                                            key={child.to}
                                            to={child.to}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition
                                                ${isActive
                                                    ? 'bg-white/10 text-white font-semibold'
                                                    : isAdmin ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-emerald-100 hover:bg-emerald-700 hover:text-white'
                                                }`
                                            }
                                        >
                                            <span className="shrink-0">{child.icon}</span>
                                            <span>{child.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            data-tour={item.tourId}
                            title={collapsed && !mobile ? item.label : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group relative
                                ${isActive
                                    ? isAdmin ? 'bg-white/10 text-white font-semibold shadow-sm' : 'bg-white/10 text-white font-semibold shadow-sm'
                                    : isAdmin ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-emerald-200 hover:bg-emerald-700 hover:text-white'
                                }`
                            }
                        >
                            <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                            {(!collapsed || mobile) && (
                                <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                            )}
                            {toggleFavorite && (!collapsed || mobile) && (
                                <span
                                    role="button"
                                    onClick={(e) => toggleFavorite(e, item)}
                                    title={isFavorited?.(item.to) ? 'Remove from favourites' : 'Add to favourites'}
                                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition
                                        ${isAdmin ? 'text-amber-400 hover:bg-gray-700' : 'text-amber-300 hover:bg-emerald-600'}`}
                                >
                                    <Star size={13} fill={isFavorited?.(item.to) ? 'currentColor' : 'none'} />
                                </span>
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
                <div className={`flex items-center gap-3 px-2 py-2 rounded-xl transition
                    ${isAdmin ? 'hover:bg-gray-800/50' : 'hover:bg-emerald-700/50'}`}>
                    {isAdmin ? (
                        <button
                            onClick={() => navigate('/admin/profile')}
                            title={t('nav.myProfile', { defaultValue: 'My Profile' })}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-800/20">
                                {initials(user?.name)}
                            </div>
                            {(!collapsed || mobile) && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate leading-none">{user?.name}</p>
                                    <p className="text-xs mt-0.5 capitalize text-gray-400">{t('status.admin')}</p>
                                </div>
                            )}
                        </button>
                    ) : isFarmer ? (
                        <button
                            onClick={() => navigate('/farmer/profile')}
                            title={t('nav.myProfile', { defaultValue: 'My Profile' })}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-emerald-300 to-emerald-400 text-emerald-900 shadow-lg shadow-emerald-400/20">
                                {initials(user?.name)}
                            </div>
                            {(!collapsed || mobile) && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate leading-none">{user?.name}</p>
                                    <p className="text-xs mt-0.5 capitalize text-emerald-300">
                                        {t('status.farmer', { defaultValue: 'Farmer' })}
                                    </p>
                                </div>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/operator/profile')}
                            title={t('nav.myProfile', { defaultValue: 'My Profile' })}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-br from-emerald-300 to-emerald-400 text-emerald-900 shadow-lg shadow-emerald-400/20">
                                {initials(user?.name)}
                            </div>
                            {(!collapsed || mobile) && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate leading-none">{user?.name}</p>
                                    <p className="text-xs mt-0.5 capitalize text-emerald-300">
                                        {t('status.operator')}
                                    </p>
                                </div>
                            )}
                        </button>
                    )}
                    {(!collapsed || mobile) && (
                        <button onClick={handleLogout} title={t('actions.logout')}
                            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition
                                ${isAdmin
                                    ? 'text-gray-400 hover:bg-gray-700/50 hover:text-rose-400'
                                    : 'text-emerald-300 hover:bg-emerald-600/50 hover:text-rose-300'}`}>
                            <LogOut size={14} />
                        </button>
                    )}
                </div>
                {collapsed && !mobile && (
                    <button onClick={handleLogout} title={t('actions.logout')}
                        className={`mt-1 w-full flex items-center justify-center py-2 rounded-xl transition
                            ${isAdmin
                                ? 'text-gray-400 hover:bg-gray-800/50 hover:text-rose-400'
                                : 'text-emerald-300 hover:bg-emerald-700/50 hover:text-rose-300'}`}>
                        <LogOut size={15} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function AppLayout() {
    const { user, logout, markTourSeen } = useAuth();
    const { appName, logoUrl } = useAppConfig();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const role = user?.role;
    const isAdmin = role === 'admin';
    const isFarmer = role === 'seller';

    const [collapsed, setCollapsed] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [favorites, setFavorites] = useState([]);

    // Fetch the logged-in user's saved favourites once on mount
    useEffect(() => {
        if (!user) return;
        api.get('/favourites')
            .then(({ data }) => {
                setFavorites(data);
            })
            .catch((err) => {
                console.error('[favourites] GET failed:', err.response?.status, err.response?.data || err.message);
            });
    }, [user]);

    const [pageVisibility, setPageVisibility] = useState(null);

    // Fetch page-visibility once per session.
    useEffect(() => {
        api.get('/settings/page-visibility')
            .then(({ data }) => setPageVisibility(data))
            .catch(() => setPageVisibility({}));
    }, []);

    const rawNavItems = useMemo(
        () => (isFarmer ? FARMER_NAV(t) : SHARED_NAV(isAdmin, t)),
        [isAdmin, isFarmer, t]
    );

    // Recursively drop any item (or child) whose pageKey has been toggled
    // off for the "web" platform.
    const filterVisible = (items) => {
        if (!pageVisibility) return items;
        return items.reduce((acc, item) => {
            if (item.pageKey && pageVisibility[item.pageKey]?.web === false) {
                return acc;
            }
            if (item.children) {
                const visibleChildren = filterVisible(item.children);
                if (visibleChildren.length === 0) return acc;
                acc.push({ ...item, children: visibleChildren });
                return acc;
            }
            acc.push(item);
            return acc;
        }, []);
    };

    const navItems = useMemo(
        () => filterVisible(rawNavItems),
        [rawNavItems, pageVisibility]
    );

    // Flatten leaf nav items
    const flatNavItems = useMemo(() => {
        const flat = [];
        navItems.forEach(item => {
            if (item.children) item.children.forEach(c => flat.push(c));
            else if (item.to) flat.push(item);
        });
        return flat;
    }, [navItems]);

    const favoriteNavItems = useMemo(() =>
        favorites.map(f => {
            const match = flatNavItems.find(n => n.to === f.nav_path);
            return match
                ? { ...match, favId: f.id }
                : { label: f.nav_label, to: f.nav_path, icon: <Star size={14} />, favId: f.id };
        }),
        [favorites, flatNavItems]);

    const displayNavItems = useMemo(() => {
        if (favoriteNavItems.length === 0) return navItems;
        return [
            {
                label: t('nav.favourites', { defaultValue: 'Favourites' }),
                icon: <Star size={16} />,
                to: null,
                tourId: 'nav-favourites',
                children: favoriteNavItems,
            },
            ...navItems,
        ];
    }, [navItems, favoriteNavItems, t]);

    const isFavorited = (path) => favorites.some(f => f.nav_path === path);

    const toggleFavorite = async (e, item) => {
        e.preventDefault();
        e.stopPropagation();
        const existing = favorites.find(f => f.nav_path === item.to);
        try {
            if (existing) {
                await api.delete(`/favourites/${existing.id}`);
                setFavorites(prev => prev.filter(f => f.id !== existing.id));
            } else {
                const { data } = await api.post('/favourites', { nav_path: item.to, nav_label: item.label });
                setFavorites(prev => [...prev, data]);
            }
        } catch (err) {
            console.error('[favourites] toggle failed:', err.response?.status, err.response?.data || err.message);
        }
    };

    const [expanded, setExpanded] = useState(() =>
        navItems.reduce((acc, item) => {
            if (item.children) acc[item.label] = true;
            return acc;
        }, {})
    );

    useEffect(() => {
        setExpanded(prev => {
            const next = { ...prev };
            navItems.forEach(item => {
                if (item.children && !(item.label in next)) next[item.label] = true;
            });
            return next;
        });
    }, [navItems]);

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    // ── First-login app tour for admins ─────────────────────────
    useEffect(() => {
        const notSeenYet = user?.has_seen_tour === 0;
        if (!(isAdmin && user && notSeenYet)) return;

        setCollapsed(false);

        const timeoutId = setTimeout(() => {
            const visibleSidebar = ['[data-sidebar="desktop"]', '[data-sidebar="tablet"]', '[data-sidebar="mobile"]']
                .map(sel => document.querySelector(sel))
                .find(el => el && el.offsetParent !== null);

            const findVisible = (tourId) => {
                if (!visibleSidebar) return null;
                const el = visibleSidebar.querySelector(`[data-tour="${tourId}"]`);
                return el && el.offsetParent !== null ? el : null;
            };

            const sidebarSelector = `[data-sidebar="${visibleSidebar.getAttribute('data-sidebar')}"]`;
            const navSteps = navItems
                .filter(item => item.tourId && findVisible(item.tourId))
                .map(item => ({
                    element: `${sidebarSelector} [data-tour="${item.tourId}"]`,
                    popover: {
                        title: item.label,
                        description: item.children
                            ? t('tour.sectionDescription', { defaultValue: `Open this to manage ${item.label}.` })
                            : t('tour.pageDescription', { defaultValue: `Go to ${item.label}.` }),
                        onPopoverRender: () => {
                            if (item.children) {
                                setExpanded(p => ({ ...p, [item.label]: true }));
                            }
                        },
                    },
                }));

            const dashboardSteps = [
                {
                    element: '[data-tour="dashboard-title"]',
                    popover: { title: 'Welcome!', description: 'This is your dashboard — your home base for everything.' },
                },
                {
                    element: '[data-tour="period-toggle"]',
                    popover: { title: 'Time Period', description: 'Switch between day, week, month, or year views.' },
                },
                {
                    element: '[data-tour="revenue-overview"]',
                    popover: { title: 'Revenue Overview', description: 'Your total profit, sales, and spend at a glance.' },
                },
                {
                    element: '[data-tour="milk-collection"]',
                    popover: { title: 'Milk Collection', description: 'Track total milk collected, payable amount, and fat/SNF averages.' },
                },
            ].filter(step => {
                const el = document.querySelector(step.element);
                return el && el.offsetParent !== null;
            });

            const steps = [...dashboardSteps, ...navSteps];

            if (steps.length === 0) return;

            const tourObj = driver({
                showProgress: true,
                allowClose: true,
                onDestroyed: () => {
                    api.put('/admin/mark-tour-seen')
                        .then(() => markTourSeen())
                        .catch(() => { });
                },
                steps,
            });
            tourObj.drive();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [isAdmin, user, t, navItems, markTourSeen]);

    // ── Server heartbeat ─────────────────────────────────────────
    useEffect(() => {
        const HEARTBEAT_INTERVAL = 30000;

        const checkServer = async () => {
            try {
                await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store', mode: 'no-cors' });
            } catch {
                window.location.reload();
            }
        };

        const intervalId = setInterval(checkServer, HEARTBEAT_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);

    const handleLogout = () => setShowLogoutConfirm(true);
    const confirmLogout = () => {
        logout();
        navigate(isAdmin ? '/' : isFarmer ? '/seller/login' : '/operator/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100/50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
                .sidebar-scroll::-webkit-scrollbar { width: 3px; }
                .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
                .sidebar-scroll::-webkit-scrollbar-thumb { border-radius: 10px; background: rgba(255,255,255,0.12); }
                .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
            `}</style>

            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setMobileOpen(false)} />
            )}

            {/* Mobile sidebar */}
            <aside data-sidebar="mobile" className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] flex flex-col transition-transform duration-300 md:hidden
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isAdmin ? 'bg-gray-900' : 'bg-emerald-800'}`}>
                <SidebarContent mobile
                    collapsed={collapsed} expanded={expanded} setExpanded={setExpanded}
                    navItems={displayNavItems} isAdmin={isAdmin} isFarmer={isFarmer} user={user} handleLogout={handleLogout}
                    appName={appName} logoUrl={logoUrl} navigate={navigate}
                    isFavorited={isFavorited} toggleFavorite={toggleFavorite}
                />
            </aside>

            {/* Tablet sidebar */}
            <aside data-sidebar="tablet" className={`hidden md:flex lg:hidden flex-col shrink-0 w-[68px]
                ${isAdmin
                    ? 'bg-gradient-to-b from-gray-900 to-gray-800'
                    : 'bg-gradient-to-b from-emerald-800 to-emerald-900'}`}>
                <SidebarContent
                    collapsed={true} expanded={expanded} setExpanded={setExpanded}
                    navItems={displayNavItems} isAdmin={isAdmin} isFarmer={isFarmer} user={user} handleLogout={handleLogout}
                    appName={appName} logoUrl={logoUrl} navigate={navigate}
                    isFavorited={isFavorited} toggleFavorite={toggleFavorite}
                />
            </aside>

            {/* Desktop sidebar */}
            <aside data-sidebar="desktop" className={`relative hidden lg:flex flex-col shrink-0 transition-all duration-300
                ${collapsed ? 'w-[68px]' : 'w-56'}
                ${isAdmin
                    ? 'bg-gradient-to-b from-gray-900 to-gray-800'
                    : 'bg-gradient-to-b from-emerald-800 to-emerald-900'}`}>
                <ToggleBtn collapsed={collapsed} onClick={() => setCollapsed(p => !p)} isAdmin={isAdmin} />
                <SidebarContent
                    collapsed={collapsed} expanded={expanded} setExpanded={setExpanded}
                    navItems={displayNavItems} isAdmin={isAdmin} isFarmer={isFarmer} user={user} handleLogout={handleLogout}
                    appName={appName} logoUrl={logoUrl} navigate={navigate}
                    isFavorited={isFavorited} toggleFavorite={toggleFavorite}
                />
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile top bar */}
                <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-white/80 backdrop-blur-sm border-gray-200/60 shadow-lg shadow-gray-200/50">
                    <button onClick={() => setMobileOpen(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100/80 hover:bg-gray-200/80 transition text-gray-600 shadow-sm shrink-0">
                        <Menu size={16} />
                    </button>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden shadow-sm shrink-0
                        ${isAdmin ? 'bg-gray-100 text-white' : 'bg-gray-100 text-white'}`}>
                        {logoUrl
                            ? <img src={logoUrl} alt={appName} className="w-full h-full object-contain p-0.5" />
                            : <Droplets size={14} />
                        }
                    </div>
                    <span className="text-sm font-semibold text-gray-800 truncate min-w-0 flex-1">{appName}</span>
                    <button
                        onClick={() => navigate(isAdmin ? '/admin/profile' : isFarmer ? '/farmer/profile' : '/operator/profile')}
                        className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm shrink-0 transition hover:scale-105 active:scale-95
        ${isAdmin ? 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 hover:shadow-md' : 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 hover:shadow-md'}`}>
                        {initials(user?.name)}
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto tracking-tighter bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
                    <Outlet />
                </main>
            </div>
            {
                showLogoutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 px-6 py-5 w-full max-w-80 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shrink-0">
                                    <LogOut size={16} className="text-rose-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Confirm Logout</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Are you sure you want to log out?</p>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => setShowLogoutConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                                    Cancel
                                </button>
                                <button onClick={confirmLogout}
                                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white hover:shadow-xl hover:shadow-rose-500/30 transition shadow-lg shadow-rose-500/20">
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