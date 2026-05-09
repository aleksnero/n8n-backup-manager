import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Copy, Download, RefreshCw, Trash2, FileText } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';

// Skeleton для часу завантаження логів
function LogsSkeleton() {
    return (
        <div>
            <div style={{ height: '2.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-line" style={{ width: '180px', height: '2rem' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton skeleton-line" style={{ width: '80px', height: '2.2rem', borderRadius: 'var(--radius)' }} />
                    ))}
                </div>
            </div>
            <div className="skeleton-card" style={{ fontFamily: 'monospace' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="skeleton skeleton-line" style={{ width: '160px', flexShrink: 0 }} />
                        <div className="skeleton skeleton-line" style={{ width: '50px', flexShrink: 0 }} />
                        <div className="skeleton skeleton-line" style={{ flex: 1 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// Колір рядка залежно від рівня логу
const LOG_ROW_BG = {
    error: 'rgba(239, 68, 68, 0.06)',
    warn:  'rgba(245, 158, 11, 0.06)',
    info:  'transparent',
};

const LOG_LEVEL_COLOR = {
    error: 'var(--error)',
    warn:  'var(--warning)',
    info:  'var(--success)',
};

export default function Logs() {
    const { t } = useTranslation();
    const toast = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [levelFilter, setLevelFilter] = useState('all');
    const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        fetchLogs();
        // Авто-оновлення кожні 5 секунд
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('/api/logs');
            setLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch logs', error);
        } finally {
            setLoading(false);
        }
    };

    // Фільтрація за рівнем — обчислюється лише при зміні logs або levelFilter
    const filteredLogs = useMemo(() => {
        if (levelFilter === 'all') return logs;
        return logs.filter(log => log.level === levelFilter);
    }, [logs, levelFilter]);

    const handleCopy = () => {
        const text = filteredLogs.map(log =>
            `${new Date(log.createdAt).toLocaleString()}\t${log.level.toUpperCase()}\t${log.message}`
        ).join('\n');

        navigator.clipboard.writeText(text)
            .then(() => toast.success(t('copied_clipboard')))
            .catch(() => toast.error(t('copy_failed')));
    };

    const handleDownload = () => {
        const text = logs.map(log =>
            `${new Date(log.createdAt).toLocaleString()}\t${log.level.toUpperCase()}\t${log.message}`
        ).join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleClear = async () => {
        try {
            await axios.delete('/api/logs');
            setLogs([]);
            toast.success(t('logs_cleared'));
        } catch (error) {
            toast.error(t('clear_failed') + (error.response?.data?.message || error.message));
        }
    };

    if (loading) return <LogsSkeleton />;

    const levelCounts = {
        error: logs.filter(l => l.level === 'error').length,
        warn:  logs.filter(l => l.level === 'warn').length,
        info:  logs.filter(l => l.level === 'info').length,
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ margin: 0 }}>
                    {t('logs_title')}
                    {logs.length > 0 && (
                        <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '0.75rem' }}>
                            ({filteredLogs.length}{levelFilter !== 'all' ? `/${logs.length}` : ''})
                        </span>
                    )}
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={handleCopy} className="btn btn-secondary" title={t('copy_logs')}>
                        <Copy size={16} style={{ marginRight: '0.4rem' }} />
                        {t('copy_logs')}
                    </button>
                    <button onClick={handleDownload} className="btn btn-secondary" title={t('download_logs')}>
                        <Download size={16} style={{ marginRight: '0.4rem' }} />
                        {t('download_logs')}
                    </button>
                    <button onClick={fetchLogs} className="btn btn-secondary" title={t('refresh_logs')}>
                        <RefreshCw size={16} style={{ marginRight: '0.4rem' }} />
                        {t('refresh_logs')}
                    </button>
                    <button
                        onClick={() => setConfirmClear(true)}
                        className="btn btn-secondary"
                        style={{ color: 'var(--error)' }}
                        title={t('clear_logs')}
                    >
                        <Trash2 size={16} style={{ marginRight: '0.4rem' }} />
                        {t('clear_logs')}
                    </button>
                </div>
            </div>

            {/* Фільтр рівнів */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {['all', 'info', 'warn', 'error'].map(level => (
                    <button
                        key={level}
                        onClick={() => setLevelFilter(level)}
                        className="btn btn-secondary"
                        style={{
                            fontSize: '0.85rem',
                            padding: '0.3rem 0.8rem',
                            borderRadius: 'var(--radius)',
                            border: levelFilter === level ? '1px solid var(--accent)' : '1px solid transparent',
                            color: level === 'error' ? 'var(--error)'
                                 : level === 'warn'  ? 'var(--warning)'
                                 : level === 'info'  ? 'var(--success)'
                                 : 'var(--text-primary)',
                            background: levelFilter === level ? 'rgba(234,75,113,0.08)' : undefined,
                        }}
                    >
                        {t(`level_${level}`)}
                        {level !== 'all' && levelCounts[level] > 0 && (
                            <span style={{ marginLeft: '0.4rem', opacity: 0.7 }}>({levelCounts[level]})</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="card" style={{ maxHeight: '600px', overflowY: 'auto', fontFamily: 'monospace', padding: 0 }}>
                {filteredLogs.map((log) => (
                    <div
                        key={log.id}
                        style={{
                            padding: '0.5rem 1rem',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            gap: '1rem',
                            backgroundColor: LOG_ROW_BG[log.level] || 'transparent',
                        }}
                    >
                        <span style={{ color: 'var(--text-secondary)', minWidth: '170px', fontSize: '0.85rem' }}>
                            {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <span style={{
                            fontWeight: 'bold',
                            color: LOG_LEVEL_COLOR[log.level] || 'var(--text-secondary)',
                            minWidth: '50px',
                            textTransform: 'uppercase',
                            fontSize: '0.8rem',
                            paddingTop: '0.1rem',
                        }}>
                            {log.level}
                        </span>
                        <span style={{ flex: 1, wordBreak: 'break-all' }}>{log.message}</span>
                    </div>
                ))}
                {filteredLogs.length === 0 && (
                    <EmptyState
                        icon={<FileText size={48} />}
                        title={levelFilter !== 'all' ? t('no_logs_for_level') : t('no_logs')}
                    />
                )}
            </div>

            {/* Діалог підтвердження очищення */}
            <ConfirmModal
                isOpen={confirmClear}
                message={t('confirm_clear_logs')}
                onConfirm={() => { setConfirmClear(false); handleClear(); }}
                onCancel={() => setConfirmClear(false)}
                confirmText={t('clear_logs')}
                cancelText={t('cancel_btn')}
                danger
            />
        </div>
    );
}
