import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Play, Clock, Database, AlertCircle, Workflow, ArrowRight, Megaphone, ExternalLink, Check, Eye, CheckCircle2, X } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Sparkline from '../components/Sparkline';

// Skeleton для карток на час завантаження
function DashboardSkeleton() {
    return (
        <div>
            <div style={{ height: '2rem', marginBottom: '2rem' }}>
                <div className="skeleton skeleton-line" style={{ width: '200px', height: '2rem' }} />
            </div>
            <div className="skeleton-card" style={{ marginBottom: '2rem' }}>
                <div className="skeleton skeleton-line" style={{ width: '40%', marginBottom: '1.5rem' }} />
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    {[1, 2].map(i => (
                        <div key={i} className="skeleton skeleton-line" style={{ width: '180px', height: '1.5rem' }} />
                    ))}
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-card">
                        <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                        <div className="skeleton skeleton-line" style={{ width: '40%', height: '1.5rem' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { t, language } = useTranslation();
    const toast = useToast();
    const [backups, setBackups] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [news, setNews] = useState(null);
    const [logs, setLogs] = useState([]);
    const [countdown, setCountdown] = useState('');
    const [status, setStatus] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    // Поле для введення назви ручного бекапу
    const [backupLabel, setBackupLabel] = useState('');
    // Стан процесу бекапу — блокує кнопку поки бекап іде
    const [isBackingUp, setIsBackingUp] = useState(false);
    // Дані для блоку Workflow Snapshots
    const [workflowSnapshots, setWorkflowSnapshots] = useState([]);
    const [liveWorkflowsCount, setLiveWorkflowsCount] = useState(0);
    const [snapshotConfig, setSnapshotConfig] = useState(null);
    const [snapshotCountdown, setSnapshotCountdown] = useState('');

    // Стрічка динамічних новин та анонсів проекту
    const [newsFeed, setNewsFeed] = useState([]);
    const [readNewsIds, setReadNewsIds] = useState(() => {
        try {
            const saved = localStorage.getItem('n8n_backup_read_news');
            return saved ? JSON.parse(saved) : [];
        } catch (_) {
            return [];
        }
    });
    // Стан для прихованих / видалених користувачем новин
    const [dismissedNewsIds, setDismissedNewsIds] = useState(() => {
        try {
            const saved = localStorage.getItem('n8n_backup_dismissed_news');
            return saved ? JSON.parse(saved) : [];
        } catch (_) {
            return [];
        }
    });
    const [showAllNews, setShowAllNews] = useState(false);

    // Зміна статусу прочитаності оголошення
    const toggleReadNews = (id) => {
        setReadNewsIds(prev => {
            const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
            try {
                localStorage.setItem('n8n_backup_read_news', JSON.stringify(next));
            } catch (_) {}
            return next;
        });
    };

    // Приховування / видалення новини зі списку назавжди
    const dismissNews = (id) => {
        setDismissedNewsIds(prev => {
            const next = prev.includes(id) ? prev : [...prev, id];
            try {
                localStorage.setItem('n8n_backup_dismissed_news', JSON.stringify(next));
            } catch (_) {}
            return next;
        });
    };

    // Тільки новини, які не були видалені користувачем
    const activeNewsFeed = useMemo(() => {
        return newsFeed.filter(item => !dismissedNewsIds.includes(item.id));
    }, [newsFeed, dismissedNewsIds]);

    // Підрахунок кількості непрочитаних новин
    const unreadCount = useMemo(() => {
        return activeNewsFeed.filter(item => !readNewsIds.includes(item.id)).length;
    }, [activeNewsFeed, readNewsIds]);

    // Фільтрація новин: показуємо тільки непрочитані, або всі якщо увімкнено showAllNews
    const visibleNews = useMemo(() => {
        if (showAllNews) return activeNewsFeed;
        return activeNewsFeed.filter(item => !readNewsIds.includes(item.id));
    }, [activeNewsFeed, readNewsIds, showAllNews]);

    useEffect(() => {
        fetchData();
        fetchStatus();
        const statusInterval = setInterval(fetchStatus, 30000);
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(statusInterval);
            clearInterval(clockInterval);
        };
    }, []);

    useEffect(() => {
        if (settings.backup_schedule) {
            updateCountdown(settings.backup_schedule);
            const timer = setInterval(() => updateCountdown(settings.backup_schedule), 1000);
            return () => clearInterval(timer);
        }
    }, [settings.backup_schedule, backups]);

    useEffect(() => {
        if (snapshotConfig?.enabled) {
            updateSnapshotCountdown(snapshotConfig, workflowSnapshots);
            const timer = setInterval(() => updateSnapshotCountdown(snapshotConfig, workflowSnapshots), 1000);
            return () => clearInterval(timer);
        } else {
            setSnapshotCountdown(t('not_scheduled'));
        }
    }, [snapshotConfig, workflowSnapshots]);

    const fetchData = async () => {
        try {
            const [backupsRes, settingsRes, logsRes, wfSnapRes, wfLiveRes, newsFeedRes, wfSchedRes] = await Promise.all([
                axios.get('/api/backups'),
                axios.get('/api/settings'),
                axios.get('/api/logs'),
                axios.get('/api/workflow-snapshots').catch(() => ({ data: [] })),
                axios.get('/api/workflow-snapshots/live').catch(() => ({ data: [] })),
                axios.get('/api/news').catch(() => ({ data: { news: [] } })),
                axios.get('/api/workflow-snapshots/schedule/config').catch(() => ({ data: null })),
            ]);
            setBackups(backupsRes.data);
            setSettings(settingsRes.data);
            setLogs(logsRes.data);
            setWorkflowSnapshots(wfSnapRes.data || []);
            setLiveWorkflowsCount((wfLiveRes.data || []).length);
            if (newsFeedRes.data?.news) {
                setNewsFeed(newsFeedRes.data.news);
            }
            if (wfSchedRes?.data) {
                setSnapshotConfig(wfSchedRes.data);
            }
            updateCountdown(settingsRes.data.backup_schedule);

            // Отримуємо новини (інфо про оновлення) — помилки ігноруємо тихо
            try {
                const updateRes = await axios.post('/api/settings/update/check');
                if (updateRes.data) setNews(updateRes.data);
            } catch (_) { /* мовчазна помилка, якщо немає мережі */ }

        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const updateCountdown = (schedule) => {
        if (!schedule || schedule === 'Not scheduled') {
            setCountdown(t('not_scheduled'));
            return;
        }

        let nextTime;
        const now = new Date();

        if (schedule.startsWith('interval:')) {
            const minutes = parseInt(schedule.split(':')[1]);
            const lastBackup = backups.length > 0 ? new Date(backups[0].createdAt) : now;
            nextTime = new Date(lastBackup.getTime() + minutes * 60000);
        } else {
            const todayMidnight = new Date();
            todayMidnight.setHours(24, 0, 0, 0);
            nextTime = todayMidnight;
        }

        const diff = nextTime - now;
        if (diff <= 0) {
            setCountdown(t('due_now'));
        } else {
            const pad = (n) => n.toString().padStart(2, '0');
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
        }
    };

    const updateSnapshotCountdown = (config, snapshots) => {
        if (!config || !config.enabled) {
            setSnapshotCountdown(t('not_scheduled'));
            return;
        }

        let nextTime;
        const now = new Date();
        const schedule = config.schedule || 'interval:360';

        if (schedule.startsWith('interval:')) {
            const minutes = parseInt(schedule.split(':')[1], 10) || 360;
            const lastSnapshot = (snapshots && snapshots.length > 0) ? new Date(snapshots[0].createdAt) : now;
            nextTime = new Date(lastSnapshot.getTime() + minutes * 60000);
        } else {
            const todayMidnight = new Date();
            todayMidnight.setHours(24, 0, 0, 0);
            nextTime = todayMidnight;
        }

        const diff = nextTime - now;
        if (diff <= 0) {
            setSnapshotCountdown(t('due_now') || 'Due now');
        } else {
            const pad = (n) => n.toString().padStart(2, '0');
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setSnapshotCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/backups/status');
            setStatus(res.data);
        } catch (error) {
            console.error('Failed to fetch status', error);
        }
    };

    const handleBackupNow = async () => {
        if (isBackingUp) return;
        setIsBackingUp(true);
        try {
            // Передаємо label якщо користувач ввів назву
            await axios.post('/api/backups', { label: backupLabel.trim() || null });
            setBackupLabel('');
            fetchData();
            toast.success(t('backup_started'));
        } catch (error) {
            toast.error('Backup failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('backup', file);

        try {
            await axios.post('/api/backups/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchData();
            toast.success(t('backup_uploaded'));
        } catch (error) {
            toast.error('Upload failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    if (loading) return <DashboardSkeleton />;

    const lastBackup = backups.length > 0 ? backups[0] : null;

    // Формуємо список активних підключень для верхнього блоку статусу
    const connectionItems = status ? [
        { key: 'n8n', label: t('n8n_container'), color: status.n8n ? 'var(--success)' : 'var(--error)', active: status.n8n },
        { key: 'database', label: t('database'), color: status.database ? 'var(--success)' : 'var(--error)', active: status.database },
        ...(status.gdrive !== undefined ? [{ key: 'gdrive', label: 'Google Drive', color: '#4285F4', active: status.gdrive }] : []),
        ...(status.onedrive !== undefined ? [{ key: 'onedrive', label: 'OneDrive', color: '#0078D4', active: status.onedrive }] : []),
        ...(status.s3 !== undefined ? [{ key: 's3', label: 'Amazon S3', color: '#FF9900', active: status.s3 }] : []),
        ...(status.notificationChannels && status.notificationChannels.length > 0
            ? status.notificationChannels.map(ch => ({
                key: ch.id,
                label: ch.name,
                color: ch.active ? 'var(--success)' : 'var(--error)',
                active: ch.active,
                icon: ch.type === 'telegram' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9" style={{ flexShrink: 0 }}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.63 3.73-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.38-.49 1.04-.75 4.07-1.77 6.78-2.94 8.14-3.52 3.87-1.65 4.67-1.94 5.2-1.95.12 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.21-.04.36z"/>
                    </svg>
                ) : null
            }))
            : (status.telegram !== undefined ? [{
                key: 'telegram',
                label: 'Telegram',
                color: status.telegram ? 'var(--success)' : 'var(--error)',
                active: status.telegram,
                icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9" style={{ flexShrink: 0 }}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.63 3.73-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.38-.49 1.04-.75 4.07-1.77 6.78-2.94 8.14-3.52 3.87-1.65 4.67-1.94 5.2-1.95.12 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.21-.04.36z"/>
                    </svg>
                )
            }] : []))
    ] : [];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ margin: 0 }}>{t('dashboard')}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <Clock size={18} color="var(--accent)" />
                        <span style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {currentTime.toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </div>

            {status && (
                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>{t('connection_status')}</h3>
                    <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
                        {connectionItems.map(({ key, label, color, active, icon }) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color, boxShadow: active ? `0 0 12px ${color}` : 'none', opacity: active ? 1 : 0.3, transition: 'all 0.3s ease', flexShrink: 0 }} />
                                {icon}
                                <span style={{ fontSize: '1.1rem' }}>
                                    {label}: <strong>{active ? t('connected') : t('disconnected')}</strong>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="dashboard-grid">
                {/* 1. Наступний бекап */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                            <div className="settings-card-icon" style={{ width: '38px', height: '38px' }}>
                                <Clock size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{t('next_backup')}</h3>
                        </div>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
                            {settings.backup_schedule?.startsWith('interval') ? t('interval') : t('scheduled')}
                        </p>
                    </div>
                    {countdown && (
                        <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '1.1rem', fontFamily: 'monospace' }}>
                            {countdown}
                        </p>
                    )}
                </div>

                {/* 2. Останній бекап */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                            <div className="settings-card-icon" style={{ width: '38px', height: '38px' }}>
                                <Database size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{t('last_backup')}</h3>
                        </div>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', wordBreak: 'break-word' }}>
                            {lastBackup ? new Date(lastBackup.createdAt).toLocaleString() : t('never')}
                        </p>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                        {lastBackup ? `${(lastBackup.size / 1024 / 1024).toFixed(2)} MB` : '—'}
                    </p>
                </div>

                {/* 3. Всього бекапів */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                            <div className="settings-card-icon" style={{ width: '38px', height: '38px' }}>
                                <AlertCircle size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{t('total_backups')}</h3>
                        </div>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{backups.length}</p>
                        {backups.length > 0 && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                                {(backups.reduce((sum, b) => sum + (b.size || 0), 0) / 1024 / 1024).toFixed(1)} MB {t('total_backups').toLowerCase()}
                            </p>
                        )}
                    </div>
                    {backups.length >= 2 && (
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Sparkline
                                data={backups.slice(0, 14).reverse().map(b => b.size || 0)}
                                width={120}
                                height={44}
                                color="var(--accent)"
                            />
                        </div>
                    )}
                </div>

                {/* 4. Снапшоти процесів (Workflow Snapshots) */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                            <div className="settings-card-icon" style={{ width: '38px', height: '38px' }}>
                                <Workflow size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{t('workflow_snapshots')}</h3>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                                    {workflowSnapshots.length}
                                </p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                                    {t('snapshots')}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: 'var(--accent)' }}>
                                    {liveWorkflowsCount}
                                </p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                                    {t('live_workflows_count')}
                                </p>
                            </div>
                        </div>

                        {/* Таймер до наступного авто-снапшоту як у основного бекапу */}
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px dashed var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                <Clock size={12} />
                                <span>{snapshotConfig?.enabled ? t('next_snapshot') : (t('schedule') || 'Розклад')}:</span>
                            </div>
                            <p style={{ color: snapshotConfig?.enabled ? 'var(--text-primary)' : 'var(--text-secondary)', margin: 0, fontSize: '1.05rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {snapshotCountdown}
                            </p>
                        </div>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                        <Link
                            to="/workflows"
                            className="btn btn-secondary"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                textDecoration: 'none'
                            }}
                        >
                            <span style={{ textDecoration: 'none' }}>{t('tab_snapshots')}</span>
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Офіційна стрічка новин та оголошень проекту (GitHub News Feed) */}
            {settings.enable_news_feed !== 'false' && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div className="settings-card-icon" style={{ width: '38px', height: '38px' }}>
                                <Megaphone size={20} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{t('news_announcements')}</h3>
                                    {unreadCount > 0 && (
                                        <span style={{ 
                                            background: 'var(--accent)', 
                                            color: '#fff', 
                                            fontSize: '0.75rem', 
                                            padding: '0.15rem 0.55rem', 
                                            borderRadius: '12px', 
                                            fontWeight: 600,
                                            letterSpacing: '0.02em' 
                                        }}>
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                    {t('news_feed_desc')}
                                </p>
                            </div>
                        </div>
                        {activeNewsFeed.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAllNews(prev => !prev)}
                                className="btn btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Eye size={14} />
                                <span>{showAllNews ? t('show_unread_only') : t('show_all_news')}</span>
                            </button>
                        )}
                    </div>

                    {activeNewsFeed.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                            {t('no_news')}
                        </p>
                    ) : visibleNews.length === 0 ? (
                        <div style={{ padding: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                            <span>{t('all_news_read')}</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {visibleNews.map(item => {
                                const isRead = readNewsIds.includes(item.id);
                                const title = (typeof item.title === 'object' && item.title !== null)
                                    ? (item.title[language] || item.title['en'] || Object.values(item.title)[0])
                                    : (language === 'en' ? (item.title_en || item.title || '') : (item.title || item.title_en || ''));
                                const message = (typeof item.message === 'object' && item.message !== null)
                                    ? (item.message[language] || item.message['en'] || Object.values(item.message)[0])
                                    : (language === 'en' ? (item.content_en || item.content || item.message || '') : (item.content || item.content_en || item.message || ''));
                                const targetUrl = item.url || item.link || null;

                                const badgeConfig = {
                                    release: { label: t('badge_release'), bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', icon: '🚀' },
                                    important: { label: t('badge_important'), bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', icon: '🔥' },
                                    tip: { label: t('badge_tip'), bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', icon: '💡' },
                                    info: { label: t('badge_info'), bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: 'ℹ️' }
                                };
                                const badge = badgeConfig[item.type] || badgeConfig.info;

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            padding: '1rem 1.15rem',
                                            background: isRead ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid var(--border)',
                                            borderLeft: isRead ? '4px solid var(--border)' : '4px solid var(--accent)',
                                            transition: 'all 0.2s ease',
                                            opacity: isRead ? 0.75 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px',
                                                    background: badge.bg,
                                                    color: badge.color
                                                }}>
                                                    <span>{badge.icon}</span>
                                                    {badge.label}
                                                </span>
                                                <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                                                    {title}
                                                </strong>
                                                {item.date && (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        • {new Date(item.date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleReadNews(item.id)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        padding: '0.3rem 0.6rem',
                                                        fontSize: '0.78rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={isRead ? t('restore_news') : t('dismiss_news')}
                                                >
                                                    <Check size={13} color={isRead ? 'var(--text-secondary)' : 'var(--accent)'} />
                                                    <span>{isRead ? t('restore_news') : t('dismiss_news')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => dismissNews(item.id)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                        padding: '0.3rem 0.45rem',
                                                        fontSize: '0.78rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={t('delete')}
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        <p style={{
                                            margin: '0 0 0.65rem 0',
                                            fontSize: '0.88rem',
                                            lineHeight: 1.5,
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'pre-line'
                                        }}>
                                            {message}
                                        </p>

                                        {targetUrl && (
                                            <a
                                                href={targetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    fontSize: '0.82rem',
                                                    color: 'var(--accent)',
                                                    textDecoration: 'none',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <span>{t('read_more')}</span>
                                                <ExternalLink size={13} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* System Activity & Updates */}
            <div className="card" style={{ marginBottom: '2rem', border: '1px dashed var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>📊</span>
                    <h3 style={{ margin: 0 }}>{t('system_activity')}</h3>
                </div>
                    {news && news.hasUpdate && (
                        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--accent)', marginBottom: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)' }}>{t('update_available_hint')}</h4>
                            <p style={{ margin: 0 }}><strong>v{news.remoteVersion}</strong> — {new Date(news.releaseDate || Date.now()).toLocaleDateString()}</p>
                        </div>
                    )}
                    {logs && logs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {logs.slice(0, 4).map(log => (
                                <div key={log.id} style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-secondary)', minWidth: '130px' }}>
                                        {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                    <span style={{ 
                                        color: log.level === 'error' ? 'var(--error)' : 
                                               log.level === 'warning' ? 'var(--warning)' : 
                                               log.level === 'success' ? 'var(--success)' : 'var(--accent)',
                                        fontWeight: 'bold',
                                        minWidth: '70px'
                                    }}>
                                        {log.level.toUpperCase()}
                                    </span>
                                    <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)' }}>{t('no_logs')}</p>
                    )}
                </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>{t('quick_actions')}</h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={backupLabel}
                        onChange={e => setBackupLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !isBackingUp && handleBackupNow()}
                        placeholder={t('backup_label_placeholder')}
                        style={{ flex: '1 1 180px', minWidth: '140px', maxWidth: '280px' }}
                        disabled={isBackingUp}
                    />
                    <button
                        onClick={handleBackupNow}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', opacity: isBackingUp ? 0.7 : 1 }}
                        disabled={isBackingUp}
                    >
                        {isBackingUp ? (
                            <>
                                <span className="spinner" />
                                {t('backing_up')}
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                {t('backup_now')}
                            </>
                        )}
                    </button>
                    <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept=".tar,.sql,.zip" />
                        {uploading ? t('uploading') : t('upload_backup')}
                    </label>
                </div>
            </div>
        </div>
    );
}
