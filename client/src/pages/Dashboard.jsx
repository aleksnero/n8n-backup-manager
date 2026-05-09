import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Play, Clock, Database, AlertCircle } from 'lucide-react';
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {[1, 2, 3].map(i => (
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
    const { t } = useTranslation();
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

    const fetchData = async () => {
        try {
            const [backupsRes, settingsRes, logsRes] = await Promise.all([
                axios.get('/api/backups'),
                axios.get('/api/settings'),
                axios.get('/api/logs'),
            ]);
            setBackups(backupsRes.data);
            setSettings(settingsRes.data);
            setLogs(logsRes.data);
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
                        {[
                            { key: 'n8n', label: t('n8n_container'), color: status.n8n ? 'var(--success)' : 'var(--error)', active: status.n8n },
                            { key: 'database', label: t('database'), color: status.database ? 'var(--success)' : 'var(--error)', active: status.database },
                            ...(status.gdrive !== undefined ? [{ key: 'gdrive', label: 'Google Drive', color: '#4285F4', active: status.gdrive }] : []),
                            ...(status.onedrive !== undefined ? [{ key: 'onedrive', label: 'OneDrive', color: '#0078D4', active: status.onedrive }] : []),
                        ].map(({ key, label, color, active }) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color, boxShadow: active ? `0 0 12px ${color}` : 'none', opacity: active ? 1 : 0.3, transition: 'all 0.3s ease' }} />
                                <span style={{ fontSize: '1.1rem' }}>
                                    {label}: <strong>{active ? t('connected') : t('disconnected')}</strong>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Clock size={24} color="var(--accent)" />
                        <h3>{t('next_backup')}</h3>
                    </div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {settings.backup_schedule?.startsWith('interval') ? t('interval') : t('scheduled')}
                    </p>
                    {countdown && <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.2rem', fontFamily: 'monospace' }}>{countdown}</p>}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Database size={24} color="var(--success)" />
                        <h3>{t('last_backup')}</h3>
                    </div>
                    <p style={{ fontSize: '1.2rem' }}>
                        {lastBackup ? new Date(lastBackup.createdAt).toLocaleString() : t('never')}
                    </p>
                    {lastBackup && <p style={{ color: 'var(--text-secondary)' }}>{(lastBackup.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <AlertCircle size={24} color="var(--warning)" />
                                <h3>{t('total_backups')}</h3>
                            </div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{backups.length}</p>
                            {backups.length > 0 && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                    {(backups.reduce((sum, b) => sum + (b.size || 0), 0) / 1024 / 1024).toFixed(1)} MB {t('total_backups').toLowerCase()}
                                </p>
                            )}
                        </div>
                        {backups.length >= 2 && (
                            <Sparkline
                                data={backups.slice(0, 14).reverse().map(b => b.size || 0)}
                                width={100}
                                height={48}
                                color="var(--warning)"
                            />
                        )}
                    </div>
                </div>

                {/* System Activity & Updates */}
                <div className="card" style={{ gridColumn: '1 / -1', border: '1px dashed var(--border)' }}>
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
