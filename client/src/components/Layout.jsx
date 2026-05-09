import { useState, useEffect } from 'react';
import axios from 'axios';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { LayoutDashboard, Database, Settings, FileText, LogOut, RefreshCw, Menu, X, Globe, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
    const { user, logout } = useAuth();
    const { t, language, toggleLanguage } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [version, setVersion] = useState('');

    useEffect(() => {
        // Версія додатку — отримується з /api/settings де вона вже інжектується сервером
        axios.get('/api/settings')
            .then(res => {
                if (res.data.version) setVersion(res.data.version);
            })
            .catch(() => setVersion(''));
    }, []);

    const navItems = [
        { path: '/', icon: <LayoutDashboard size={20} />, label: t('dashboard') },
        { path: '/backups', icon: <Database size={20} />, label: t('database') },
        { path: '/settings', icon: <Settings size={20} />, label: t('settings') },
        { path: '/logs', icon: <FileText size={20} />, label: t('logs') },
        { path: '/updates', icon: <RefreshCw size={20} />, label: t('updates') },
    ];

    return (
        <div className="layout-container">
            <button
                className="mobile-menu-toggle btn btn-secondary"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>



            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <h2 className="sidebar-title">Backup Manager</h2>
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.username[0].toUpperCase()}
                        </div>
                        <span className="user-name">{user?.username}</span>
                    </div>

                    <button
                        onClick={toggleLanguage}
                        className="btn btn-secondary"
                        style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        <Globe size={16} />
                        <span>{language === 'en' ? 'Українська' : 'English'}</span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="btn btn-secondary"
                        title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
                        style={{ width: '100%', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>

                    <button
                        onClick={logout}
                        className="btn logout-btn"
                    >
                        <LogOut size={20} />
                        {t('logout')}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        v{version}
                    </div>
                </div>
            </aside>

            {isMobileMenuOpen && (
                <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
