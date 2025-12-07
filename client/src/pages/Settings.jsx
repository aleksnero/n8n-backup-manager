import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, RefreshCw, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState({
        n8n_container_name: 'n8n',
        db_type: 'sqlite',
        db_path: '/home/node/.n8n/database.sqlite',
        db_user: 'n8n',
        db_password: '',
        db_name: 'n8n',
        backup_schedule: '0 0 * * *',
        backup_retention_count: '10'
    });
    const [loading, setLoading] = useState(true);
    const [scheduleType, setScheduleType] = useState('cron'); // 'cron' or 'interval'
    const [intervalHours, setIntervalHours] = useState(1);

    // Update State
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, updating, success, error
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateMessage, setUpdateMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings');
            if (Object.keys(res.data).length > 0) {
                setSettings(prev => ({ ...prev, ...res.data }));

                // Parse schedule for UI
                if (res.data.backup_schedule && res.data.backup_schedule.startsWith('interval:')) {
                    setScheduleType('interval');
                    const mins = parseInt(res.data.backup_schedule.split(':')[1]);
                    setIntervalHours(Math.round(mins / 60));
                } else {
                    setScheduleType('cron');
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleScheduleChange = (type, value) => {
        setScheduleType(type);
        if (type === 'interval') {
            setIntervalHours(value);
            setSettings(prev => ({ ...prev, backup_schedule: `interval:${value * 60}` }));
        } else {
            // If switching to cron, keep existing or default
            if (settings.backup_schedule.startsWith('interval:')) {
                setSettings(prev => ({ ...prev, backup_schedule: '0 0 * * *' }));
            }
        }
    };

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        setUpdateMessage('');
        try {
            // Use /api/settings/update/mock for testing UI, or /api/settings/update/check for real
            // For now, let's use the check endpoint which calls our service (which might be mocked)
            const res = await axios.post('/api/settings/update/check');
            if (res.data.hasUpdate) {
                setUpdateStatus('available');
                setUpdateInfo(res.data);
            } else {
                setUpdateStatus('idle');
                setUpdateMessage('You are on the latest version.');
                setTimeout(() => setUpdateMessage(''), 3000);
            }
        } catch (error) {
            setUpdateStatus('error');
            setUpdateMessage('Failed to check for updates.');
            console.error(error);
        }
    };

    const applyUpdate = async () => {
        if (!updateInfo || !updateInfo.downloadUrl) return;

        if (!confirm('The server will restart to apply the update. Continue?')) return;

        setUpdateStatus('updating');
        try {
            const res = await axios.post('/api/settings/update/apply', { downloadUrl: updateInfo.downloadUrl });
            if (res.data.success) {
                setUpdateStatus('success');
                setUpdateMessage('Update applied! Server is restarting. Please refresh the page in a few moments.');
            }
        } catch (error) {
            setUpdateStatus('error');
            setUpdateMessage('Failed to apply update: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/settings', settings);
            // alert('Settings saved successfully!'); // Removed alert
            navigate('/'); // Redirect to dashboard
        } catch (error) {
            alert('Failed to save settings: ' + error.response?.data?.message);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ marginBottom: '2rem' }}>Settings</h1>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Container Configuration</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database Container Name</label>
                        <input
                            type="text"
                            name="n8n_container_name"
                            value={settings.n8n_container_name}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>The name of your Database docker container (e.g., postgres-1).</small>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database Type</label>
                        <select name="db_type" value={settings.db_type} onChange={handleChange}>
                            <option value="sqlite">SQLite</option>
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    </div>

                    {settings.db_type === 'sqlite' ? (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database Path (Inside Container)</label>
                            <input
                                type="text"
                                name="db_path"
                                value={settings.db_path}
                                onChange={handleChange}
                            />
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database User</label>
                                <input
                                    type="text"
                                    name="db_user"
                                    value={settings.db_user}
                                    onChange={handleChange}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database Password</label>
                                <input
                                    type="password"
                                    name="db_password"
                                    value={settings.db_password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Database Name</label>
                                <input
                                    type="text"
                                    name="db_name"
                                    value={settings.db_name}
                                    onChange={handleChange}
                                />
                            </div>
                        </>
                    )}

                    <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Backup Schedule</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Schedule Type</label>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={scheduleType === 'interval'}
                                    onChange={() => handleScheduleChange('interval', intervalHours)}
                                />
                                Every X Hours
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    checked={scheduleType === 'cron'}
                                    onChange={() => handleScheduleChange('cron')}
                                />
                                Custom Cron Expression
                            </label>
                        </div>

                        {scheduleType === 'interval' ? (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Interval (Hours)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={intervalHours}
                                    onChange={(e) => handleScheduleChange('interval', parseInt(e.target.value) || 1)}
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>Backup will run every {intervalHours} hours.</small>
                            </div>
                        ) : (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Cron Expression</label>
                                <input
                                    type="text"
                                    name="backup_schedule"
                                    value={settings.backup_schedule}
                                    onChange={handleChange}
                                    placeholder="0 0 * * *"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>Standard cron expression (e.g., '0 0 * * *' for daily at midnight).</small>
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Protected Backups Count</label>
                        <input
                            type="number"
                            name="backup_retention_count"
                            value={settings.backup_retention_count}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>Number of most recent backups to keep protected from auto-deletion.</small>
                        <small style={{ color: 'var(--text-secondary)' }}>Number of most recent backups to keep protected from auto-deletion.</small>
                    </div>

                    <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>System Updates</h3>
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div>
                                <strong style={{ display: 'block' }}>Current Version: {settings.version || '1.0.0'}</strong>
                                {updateMessage && <span style={{ color: updateStatus === 'error' ? 'var(--error)' : 'var(--success)', fontSize: '0.9rem' }}>{updateMessage}</span>}
                            </div>
                            {updateStatus === 'idle' && (
                                <button type="button" onClick={checkForUpdates} className="btn" disabled={loading} style={{ display: 'flex', gap: '0.5rem' }}>
                                    <RefreshCw size={16} /> Check for Updates
                                </button>
                            )}
                            {updateStatus === 'checking' && (
                                <button type="button" disabled className="btn" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <RefreshCw size={16} className="spin" /> Checking...
                                </button>
                            )}
                            {updateStatus === 'available' && (
                                <button type="button" onClick={applyUpdate} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', background: 'var(--success)' }}>
                                    <Download size={16} /> Update Now
                                </button>
                            )}
                            {updateStatus === 'updating' && (
                                <button type="button" disabled className="btn" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <RefreshCw size={16} className="spin" /> Updating...
                                </button>
                            )}
                        </div>

                        {updateStatus === 'available' && updateInfo && (
                            <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                                    <CheckCircle size={16} /> <strong>New Version Available: {updateInfo.remoteVersion}</strong>
                                </div>
                                {updateInfo.releaseNotes && (
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{updateInfo.releaseNotes}</p>
                                )}
                            </div>
                        )}

                        {updateStatus === 'success' && (
                            <div style={{ background: 'rgba(0, 255, 0, 0.1)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--success)', color: 'var(--success)' }}>
                                <CheckCircle size={16} style={{ display: 'inline', marginRight: '5px' }} />
                                <strong>Success!</strong> Application is restarting...
                            </div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={16} />
                        Save Settings
                    </button>
                </form>
            </div>
        </div>
    );
}
