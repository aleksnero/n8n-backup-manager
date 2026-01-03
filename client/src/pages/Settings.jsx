import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, RefreshCw, Download, AlertTriangle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

export default function Settings() {
    const navigate = useNavigate();
    const { t } = useTranslation();
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

    // Password Change State
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
    const [passwordMessage, setPasswordMessage] = useState('');

    // Visibility States
    const [showDbPassword, setShowDbPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

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
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value }));
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
            // For now, let's use the check endpoint which calls our service
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
            alert(t('save_settings') + ' OK!');
        } catch (error) {
            alert('Failed to save settings: ' + error.response?.data?.message);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/change-password', passwordData);
            setPasswordMessage(t('pass_changed_success'));
            setPasswordData({ currentPassword: '', newPassword: '' });
        } catch (error) {
            setPasswordMessage(t('pass_change_error') + (error.response?.data?.message || error.message));
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ marginBottom: '2rem' }}>{t('settings_title')}</h1>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{t('n8n_settings')}</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('n8n_container')}</label>
                        <input
                            type="text"
                            name="n8n_container_name"
                            value={settings.n8n_container_name}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>The name of your Database docker container (e.g., postgres-1).</small>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Title</label>
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
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showDbPassword ? "text" : "password"}
                                        name="db_password"
                                        value={settings.db_password}
                                        onChange={handleChange}
                                        style={{ paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDbPassword(!showDbPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            padding: 0
                                        }}
                                    >
                                        {showDbPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
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

                    <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{t('backup_settings')}</h3>

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
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('backup_retention_count')}</label>
                        <input
                            type="number"
                            name="backup_retention_count"
                            value={settings.backup_retention_count}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>{t('retention_help')}</small>
                    </div>

                    <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{t('cloud_settings')}</h3>

                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                        <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '1rem 2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                            <input
                                type="checkbox"
                                name="aws_s3_enabled"
                                checked={settings.aws_s3_enabled === 'true'}
                                onChange={handleChange}
                                style={{ width: '20px', height: '20px' }}
                            />
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{t('enable_cloud')}</span>
                        </label>
                    </div>

                    {settings.aws_s3_enabled === 'true' && (
                        <div style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--border)' }}>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Storage Provider</label>
                                <select
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    value="s3"
                                    onChange={() => alert(t('s3_provider_warning'))}
                                >
                                    <option value="s3">S3 Compatible (MinIO, AWS, DigitalOcean)</option>
                                    <option value="gdrive" disabled>Google Drive (Coming Soon)</option>
                                    <option value="onedrive" disabled>Microsoft OneDrive (Coming Soon)</option>
                                    <option value="dropbox" disabled>Dropbox (Coming Soon)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('endpoint')}</label>
                                <input
                                    type="text"
                                    name="aws_s3_endpoint"
                                    value={settings.aws_s3_endpoint || ''}
                                    onChange={handleChange}
                                    placeholder="https://s3.amazonaws.com"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>Leave empty for AWS. Required for MinIO, DigitalOcean Spaces, etc.</small>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('region')}</label>
                                <input
                                    type="text"
                                    name="aws_s3_region"
                                    value={settings.aws_s3_region || ''}
                                    onChange={handleChange}
                                    placeholder="us-east-1"
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('bucket')}</label>
                                <input
                                    type="text"
                                    name="aws_s3_bucket"
                                    value={settings.aws_s3_bucket || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('access_key')}</label>
                                <input
                                    type="text"
                                    name="aws_s3_access_key"
                                    value={settings.aws_s3_access_key || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('secret_key')}</label>
                                <input
                                    type="password"
                                    name="aws_s3_secret_key"
                                    value={settings.aws_s3_secret_key || ''}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}


                    {/* Update Block Removed */}


                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={16} />
                        {t('save_settings')}
                    </button>
                </form>
            </div>

            {/* Password Change Section */}
            <div className="card" style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{t('change_password')}</h3>
                <form onSubmit={handlePasswordChange}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('current_password')}</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                required
                                style={{ paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: 0
                                }}
                            >
                                {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('new_password')}</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNewPassword ? "text" : "password"}
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                required
                                style={{ paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: 0
                                }}
                            >
                                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    {passwordMessage && (
                        <div style={{ marginBottom: '1rem', color: passwordMessage.includes('Success') || passwordMessage.includes('успішно') ? 'var(--success)' : 'var(--error)' }}>
                            {passwordMessage}
                        </div>
                    )}
                    <button type="submit" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock size={16} />
                        {t('change_pass_btn')}
                    </button>
                </form>
            </div>
        </div>
    );
}
