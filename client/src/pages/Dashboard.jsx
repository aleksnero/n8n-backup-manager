import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Clock, Database, AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function Dashboard() {
    const { t } = useTranslation();
    const [backups, setBackups] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [news, setNews] = useState(null);
    const [nextBackup, setNextBackup] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [status, setStatus] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchData();
        fetchStatus();
        const statusInterval = setInterval(fetchStatus, 30000); // Check every 30s

        // Real-time clock
        const clockInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            clearInterval(statusInterval);
            clearInterval(clockInterval);
        };
    }, []);

    useEffect(() => {
        if (settings.backup_schedule) {
            updateCountdown(settings.backup_schedule);
            const timer = setInterval(() => {
                updateCountdown(settings.backup_schedule);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [settings.backup_schedule, backups]);

    const fetchData = async () => {
        try {
            const [backupsRes, settingsRes] = await Promise.all([
                axios.get('/api/backups'),
                axios.get('/api/settings')
            ]);
            setBackups(backupsRes.data);
            setSettings(settingsRes.data);
            calculateNextBackup(settingsRes.data.backup_schedule);

            // Fetch News (Update Info)
            try {
                const updateRes = await axios.post('/api/settings/update/check');
                if (updateRes.data) {
                    setNews(updateRes.data);
                }
            } catch (ignore) {
                // Silently fail for news if offline or rate limited
            }

        } catch (error) {
            console.error('Failed to fetch data', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateNextBackup = (schedule) => {
        setNextBackup(schedule || 'Not scheduled');
        updateCountdown(schedule);
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
            // Simple cron handling (daily at midnight 0 0 * * *)
            // For complex cron, we'd need a parser library, but for now let's assume daily
            // This is a simplification. Ideally use 'cron-parser' package.
            const todayMidnight = new Date();
            todayMidnight.setHours(24, 0, 0, 0);
            nextTime = todayMidnight;
        }

        const diff = nextTime - now;

        if (diff <= 0) {
            setCountdown(t('due_now'));
        } else {
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            // Format HH:MM:SS
            const pad = (n) => n.toString().padStart(2, '0');
            setCountdown(`${pad(hours)}:${pad(mins)}:${pad(secs)}`);
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
        try {
            await axios.post('/api/backups');
            fetchData();
            alert(t('backup_started'));
        } catch (error) {
            alert('Backup failed: ' + error.response?.data?.message);
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
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchData();
            alert(t('backup_uploaded'));
        } catch (error) {
            alert('Upload failed: ' + error.response?.data?.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    if (loading) return <div>Loading...</div>;

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: status.n8n ? 'var(--success)' : 'var(--error)',
                                boxShadow: status.n8n ? '0 0 12px var(--success)' : '0 0 12px var(--error)',
                                transition: 'all 0.3s ease'
                            }}></div>
                            <span style={{ fontSize: '1.1rem' }}>{t('n8n_container')}: <strong>{status.n8n ? t('connected') : t('disconnected')}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: status.database ? 'var(--success)' : 'var(--error)',
                                boxShadow: status.database ? '0 0 12px var(--success)' : '0 0 12px var(--error)',
                                transition: 'all 0.3s ease'
                            }}></div>
                            <span style={{ fontSize: '1.1rem' }}>{t('database')}: <strong>{status.database ? t('connected') : t('disconnected')}</strong></span>
                        </div>
                        {status.gdrive !== undefined && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: status.gdrive ? '#4285F4' : 'var(--text-secondary)',
                                    boxShadow: status.gdrive ? '0 0 12px #4285F4' : 'none',
                                    transition: 'all 0.3s ease',
                                    opacity: status.gdrive ? 1 : 0.3
                                }}></div>
                                <span style={{ fontSize: '1.1rem' }}>Google Drive: <strong>{status.gdrive ? t('configured') : t('not_configured')}</strong></span>
                            </div>
                        )}
                        {status.onedrive !== undefined && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: status.onedrive ? '#0078D4' : 'var(--text-secondary)',
                                    boxShadow: status.onedrive ? '0 0 12px #0078D4' : 'none',
                                    transition: 'all 0.3s ease',
                                    opacity: status.onedrive ? 1 : 0.3
                                }}></div>
                                <span style={{ fontSize: '1.1rem' }}>OneDrive: <strong>{status.onedrive ? t('configured') : t('not_configured')}</strong></span>
                            </div>
                        )}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <AlertCircle size={24} color="var(--warning)" />
                        <h3>{t('total_backups')}</h3>
                    </div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{backups.length}</p>
                </div>

                {/* News Widget */}
                <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>📢</span>
                        <h3 style={{ margin: 0 }}>Latest News</h3>
                    </div>
                    {news ? (
                        <div>
                            <p><strong>v{news.remoteVersion}</strong> - {new Date(news.releaseDate || Date.now()).toLocaleDateString()}</p>
                            <p>{news.releaseNotes || 'No release notes available.'}</p>
                            {news.hasUpdate && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>New update available! Check Updates page.</span>}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)' }}>Loading news...</p>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>{t('quick_actions')}</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={handleBackupNow} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Play size={16} />
                        {t('backup_now')}
                    </button>
                    <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept=".tar,.sql,.zip" />
                        {uploading ? t('uploading') : t('upload_backup')}
                    </label>
                </div>
            </div>
        </div >
    );
}
