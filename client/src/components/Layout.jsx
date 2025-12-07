import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Database, Settings, FileText, LogOut, RefreshCw } from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { path: '/backups', icon: <Database size={20} />, label: 'Backups' },
        { path: '/settings', icon: <Settings size={20} />, label: 'Settings' },
        { path: '/logs', icon: <FileText size={20} />, label: 'Logs' },
        { path: '/updates', icon: <RefreshCw size={20} />, label: 'Updates' },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <aside style={{ width: '250px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '2rem', color: 'var(--accent)' }}>Backup Manager</h2>
                <nav>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                color: location.pathname === item.path ? 'var(--accent)' : 'var(--text-secondary)',
                                textDecoration: 'none',
                                backgroundColor: location.pathname === item.path ? 'rgba(234, 75, 113, 0.1)' : 'transparent',
                                borderRadius: 'var(--radius)',
                                marginBottom: '0.5rem'
                            }}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {user?.username[0].toUpperCase()}
                        </div>
                        <span>{user?.username}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', marginTop: '1rem', color: 'var(--error)', backgroundColor: 'transparent' }}
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>
            <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                <Outlet />
            </main>
        </div>
    );
}
