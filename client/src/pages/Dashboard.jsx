import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Clock, Database, AlertCircle } from 'lucide-react';

export default function Dashboard() {
    const [backups, setBackups] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [nextBackup, setNextBackup] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [status, setStatus] = useState({ n8n: false, database: false });
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
            setCountdown('Not scheduled');
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
            setCountdown('Due now');
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
            alert('Backup started successfully!');
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
            alert('Backup uploaded successfully!');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Dashboard</h1>
                <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="var(--accent)" />
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {currentTime.toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* Connection Status */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Connection Status</h3>
                <div style={{ display: 'flex', gap: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: status.n8n ? 'var(--success)' : 'var(--error)',
                            boxShadow: status.n8n ? '0 0 12px var(--success)' : '0 0 12px var(--error)',
                            transition: 'all 0.3s ease'
                        }}></div>
                        <span style={{ fontSize: '1.1rem' }}>n8n Container: <strong>{status.n8n ? 'Connected' : 'Disconnected'}</strong></span>
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
                        <span style={{ fontSize: '1.1rem' }}>Database: <strong>{status.database ? 'Connected' : 'Disconnected'}</strong></span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Clock size={24} color="var(--accent)" />
                        <h3>Next Backup</h3>
                    </div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {settings.backup_schedule?.startsWith('interval') ? 'Interval' : 'Scheduled'}
                    </p>
                    {countdown && <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.2rem', fontFamily: 'monospace' }}>{countdown}</p>}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <Database size={24} color="var(--success)" />
                        <h3>Last Backup</h3>
                    </div>
                    <p style={{ fontSize: '1.2rem' }}>
                        {lastBackup ? new Date(lastBackup.createdAt).toLocaleString() : 'Never'}
                    </p>
                    {lastBackup && <p style={{ color: 'var(--text-secondary)' }}>{(lastBackup.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <AlertCircle size={24} color="var(--warning)" />
                        <h3>Total Backups</h3>
                    </div>
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{backups.length}</p>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={handleBackupNow} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Play size={16} />
                        Backup Now
                    </button>
                    <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept=".tar,.sql,.zip" />
                        {uploading ? 'Uploading...' : 'Upload Backup'}
                    </label>
                </div>
            </div>
        </div>
    );
}
