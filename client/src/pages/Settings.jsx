import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

// Skeleton для сторінки налаштувань
function SettingsSkeleton() {
    return (
        <div style={{ maxWidth: '800px' }}>
            <div className="skeleton skeleton-line" style={{ width: '200px', height: '2rem', marginBottom: '2rem' }} />
            <div className="skeleton-card">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ marginBottom: '1.5rem' }}>
                        <div className="skeleton skeleton-line" style={{ width: '40%', marginBottom: '0.5rem' }} />
                        <div className="skeleton skeleton-line" style={{ height: '2.5rem' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Settings() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const toast = useToast();
    const [confirmUpdate, setConfirmUpdate] = useState(false);
    const [settings, setSettings] = useState({
        n8n_container_name: 'n8n',
        db_container_name: 'postgres',
        db_type: 'sqlite',
        db_path: '/home/node/.n8n/database.sqlite',
        db_user: 'n8n',
        db_password: '',
        db_name: 'n8n',
        backup_schedule: '0 0 * * *',
        backup_retention_count: '10'
    });
    const [loading, setLoading] = useState(true);
    const [intervalValue, setIntervalValue] = useState(1);
    const [intervalUnit, setIntervalUnit] = useState('hours'); // 'hours' or 'minutes'

    // Update State
    const [updateStatus, setUpdateStatus] = useState('idle');
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateMessage, setUpdateMessage] = useState('');
    // Тимчасовий стан для feedback кнопки Save
    const [saveSuccess, setSaveSuccess] = useState(false);
    // Стан для тестування сповіщень
    const [isTesting, setIsTesting] = useState(false);

    // Password Change State
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
    const [passwordMessage, setPasswordMessage] = useState('');

    // Visibility States
    const [showDbPassword, setShowDbPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showEncryptionKey, setShowEncryptionKey] = useState(false);

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
                    const mins = parseInt(res.data.backup_schedule.split(':')[1]);
                    if (mins % 60 === 0) {
                        setIntervalValue(mins / 60);
                        setIntervalUnit('hours');
                    } else {
                        setIntervalValue(mins);
                        setIntervalUnit('minutes');
                    }
                } else {
                    // Default to 1 hour if it was cron or something else
                    setIntervalValue(1);
                    setIntervalUnit('hours');
                    setSettings(prev => ({ ...prev, backup_schedule: 'interval:60' }));
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

    const updateSchedule = (value, unit) => {
        const mins = unit === 'hours' ? value * 60 : value;
        setIntervalValue(value);
        setIntervalUnit(unit);
        setSettings(prev => ({ ...prev, backup_schedule: `interval:${mins}` }));
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
        // Відкрити кастомний діалог підтвердження замість confirm()
        setConfirmUpdate(true);
    };

    const doApplyUpdate = async () => {
        setConfirmUpdate(false);
        if (!updateInfo?.downloadUrl) return;
        setUpdateStatus('updating');
        try {
            const res = await axios.post('/api/settings/update/apply', { downloadUrl: updateInfo.downloadUrl });
            if (res.data.success) {
                setUpdateStatus('success');
                toast.info('Update applied! Server is restarting. Please refresh in a few moments.');
            }
        } catch (error) {
            setUpdateStatus('error');
            toast.error('Failed to apply update: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/settings', settings);
            // Показуємо тимчасовий feedback на кнопці замість переходу
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            toast.error('Failed to save settings: ' + (error.response?.data?.message || error.message));
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/change-password', passwordData);
            toast.success(t('pass_changed_success'));
            setPasswordData({ currentPassword: '', newPassword: '' });
        } catch (error) {
            toast.error(t('pass_change_error') + (error.response?.data?.message || error.message));
        }
    };

    if (loading) return <SettingsSkeleton />;

    return (
        <div style={{ maxWidth: '800px' }}>
            <h1 style={{ marginBottom: '2rem' }}>{t('settings_title')}</h1>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{t('n8n_settings')}</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('n8n_container_name') || 'n8n Container Name'}</label>
                        <input
                            type="text"
                            name="n8n_container_name"
                            value={settings.n8n_container_name}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>The name of your n8n docker container (e.g., n8n).</small>
                    </div>

                    {settings.db_type === 'postgres' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_container')}</label>
                            <input
                                type="text"
                                name="db_container_name"
                                value={settings.db_container_name}
                                onChange={handleChange}
                            />
                            <small style={{ color: 'var(--text-secondary)' }}>The name of your Database docker container (e.g., postgres-1).</small>
                        </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_type')}</label>
                        <select name="db_type" value={settings.db_type} onChange={handleChange}>
                            <option value="sqlite">SQLite</option>
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    </div>

                    {settings.db_type === 'sqlite' ? (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_path')}</label>
                            <input
                                type="text"
                                name="db_path"
                                value={settings.db_path}
                                onChange={handleChange}
                            />
                            <small style={{ color: 'var(--text-secondary)' }}>Path inside n8n container (e.g., /home/node/.n8n/database.sqlite).</small>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_user')}</label>
                                    <input
                                        type="text"
                                        name="db_user"
                                        value={settings.db_user}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_password')}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showDbPassword ? "text" : "password"}
                                            name="db_password"
                                            value={settings.db_password}
                                            onChange={handleChange}
                                            style={{ paddingRight: '2.5rem' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowDbPassword(!showDbPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: '0.5rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {showDbPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('db_name')}</label>
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
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('backup_settings')}</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="number"
                                min="1"
                                value={intervalValue}
                                onChange={(e) => updateSchedule(parseInt(e.target.value) || 1, intervalUnit)}
                                style={{ width: '100px' }}
                            />
                            <select
                                value={intervalUnit}
                                onChange={(e) => updateSchedule(intervalValue, e.target.value)}
                                style={{ width: '150px' }}
                            >
                                <option value="hours">{t('hours')}</option>
                                <option value="minutes">{t('minutes')}</option>
                            </select>
                        </div>
                        <small style={{ color: 'var(--text-secondary)' }}>
                            {t('schedule_type_hours')}: {intervalValue} {intervalUnit === 'hours' ? t('hours').toLowerCase() : t('minutes').toLowerCase()}.
                        </small>
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

                    <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Backup Optimization</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="backup_compression"
                                checked={settings.backup_compression === 'true'}
                                onChange={handleChange}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span>Compress Backups (Gzip)</span>
                        </label>
                        <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Reduces storage space but takes longer to backup/restore.</small>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="backup_encryption"
                                checked={settings.backup_encryption === 'true'}
                                onChange={handleChange}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span>Encrypt Backups (AES-256)</span>
                        </label>
                        <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>Protects your data with a password. <strong>Do not lose your key!</strong></small>
                    </div>

                    {settings.backup_encryption === 'true' && (
                        <div style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border)' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showEncryptionKey ? "text" : "password"}
                                    name="backup_encryption_key"
                                    value={settings.backup_encryption_key || ''}
                                    onChange={handleChange}
                                    placeholder="Enter a strong password"
                                    style={{ paddingRight: '40px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowEncryptionKey(!showEncryptionKey)}
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
                                    {showEncryptionKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                    )}

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
                                    name="cloud_provider"
                                    value={settings.cloud_provider || 's3'}
                                    onChange={handleChange}
                                >
                                    <option value="s3">S3 Compatible (MinIO, AWS, DigitalOcean)</option>
                                    <option value="gdrive">Google Drive</option>
                                    <option value="onedrive">Microsoft OneDrive</option>
                                </select>
                            </div>

                            {(!settings.cloud_provider || settings.cloud_provider === 's3') && (
                                <>
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
                                </>
                            )}

                            {settings.cloud_provider === 'gdrive' && (
                                <>
                                    {/* OAuth2 Client ID */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_client_id') || 'Client ID'}
                                        </label>
                                        <input
                                            type="text"
                                            name="gdrive_client_id"
                                            value={settings.gdrive_client_id || ''}
                                            onChange={handleChange}
                                            placeholder="123456789-abcdef.apps.googleusercontent.com"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('gdrive_client_id_hint') || 'Find in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.'}
                                        </small>
                                    </div>

                                    {/* OAuth2 Client Secret */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_client_secret') || 'Client Secret'}
                                        </label>
                                        <input
                                            type="password"
                                            name="gdrive_client_secret"
                                            value={settings.gdrive_client_secret || ''}
                                            onChange={handleChange}
                                            placeholder="GOCSPX-••••••••••••••••••••••••"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('gdrive_client_secret_hint') || 'Same location as Client ID — click on the credential and copy the secret.'}
                                        </small>
                                    </div>

                                    {/* OAuth2 Refresh Token */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_refresh_token') || 'Refresh Token'}
                                        </label>
                                        <input
                                            type="password"
                                            name="gdrive_refresh_token"
                                            value={settings.gdrive_refresh_token || ''}
                                            onChange={handleChange}
                                            placeholder="1//04••••••••••••••••••••••••••••"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('gdrive_refresh_token_hint') || 'Use'}{' '}
                                            <a
                                                href="https://developers.google.com/oauthplayground"
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                Google OAuth Playground
                                            </a>
                                            {': '}<code>https://www.googleapis.com/auth/drive.file</code>
                                            {t('gdrive_refresh_token_hint2') || ', sign in and click "Exchange authorization code for tokens".'}
                                        </small>
                                    </div>

                                    {/* Folder ID */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_folder_id') || 'Folder ID'}{' '}
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                {t('gdrive_folder_id_optional') || '(optional)'}
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            name="google_drive_folder_id"
                                            value={settings.google_drive_folder_id || ''}
                                            onChange={handleChange}
                                            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('gdrive_folder_id_hint') || 'Google Drive folder ID from the URL after /folders/. Leave empty to save to root.'}
                                        </small>
                                    </div>
                                </>
                            )}

                            {settings.cloud_provider === 'onedrive' && (
                                <>
                                    {/* OAuth2 Client ID */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('od_client_id') || 'Client ID (Application ID)'}
                                        </label>
                                        <input
                                            type="text"
                                            name="onedrive_client_id"
                                            value={settings.onedrive_client_id || ''}
                                            onChange={handleChange}
                                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('od_client_id_hint') || 'Find in Azure Portal → App registrations → your app → Application (client) ID.'}
                                        </small>
                                    </div>

                                    {/* OAuth2 Client Secret */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('od_client_secret') || 'Client Secret'}
                                        </label>
                                        <input
                                            type="password"
                                            name="onedrive_client_secret"
                                            value={settings.onedrive_client_secret || ''}
                                            onChange={handleChange}
                                            placeholder="••••••••••••••••••••••••••••••••••••••••"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('od_client_secret_hint') || 'Azure Portal → your app → Certificates & secrets → New client secret.'}
                                        </small>
                                    </div>

                                    {/* OAuth2 Refresh Token */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('od_refresh_token') || 'Refresh Token'}
                                        </label>
                                        <input
                                            type="password"
                                            name="onedrive_refresh_token"
                                            value={settings.onedrive_refresh_token || ''}
                                            onChange={handleChange}
                                            placeholder="M.C3_BAY.••••••••••••••••••••••••••••"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('od_refresh_token_hint') || 'Use'}{' '}
                                            <a
                                                href="https://developer.microsoft.com/en-us/graph/graph-explorer"
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                Microsoft Graph Explorer
                                            </a>
                                            {t('od_refresh_token_hint2') || ' or the OAuth2 flow to generate a refresh token with Files.ReadWrite scope.'}
                                        </small>
                                    </div>
                                </>
                            )}
                        </div>
                    )}


                    {/* Update Block Removed */}

                    {/* Notifications — Telegram */}
                    <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        🔔 {t('notifications_section') || 'Notifications'}
                    </h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="notification_enabled"
                                checked={settings.notification_enabled === 'true'}
                                onChange={handleChange}
                                style={{ width: '20px', height: '20px' }}
                            />
                            <span style={{ fontWeight: '500' }}>{t('enable_notifications') || 'Enable Telegram notifications'}</span>
                        </label>
                    </div>

                    {settings.notification_enabled === 'true' && (
                        <div style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--border)' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                    {t('telegram_token') || 'Telegram Bot Token'}
                                </label>
                                <input
                                    type="password"
                                    name="notification_telegram_token"
                                    value={settings.notification_telegram_token || ''}
                                    onChange={handleChange}
                                    placeholder="123456789:AABBccDDeeFFggHHiiJJkkLLmmNNoo"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>
                                    {t('telegram_token_hint') || 'Get it from @BotFather on Telegram'}
                                </small>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                    {t('telegram_chat_id') || 'Telegram Chat ID'}
                                </label>
                                <input
                                    type="text"
                                    name="notification_telegram_chat_id"
                                    value={settings.notification_telegram_chat_id || ''}
                                    onChange={handleChange}
                                    placeholder="-1001234567890"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>
                                    {t('telegram_chat_id_hint') || 'Your chat ID or group ID (negative for groups)'}
                                </small>
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={isTesting}
                                onClick={async () => {
                                    setIsTesting(true);
                                    try {
                                        await axios.post('/api/settings/notify/test');
                                        toast.success(t('notification_sent') || 'Test notification sent!');
                                    } catch (err) {
                                        toast.error(t('notification_failed') || 'Failed to send: ' + (err.response?.data?.message || err.message));
                                    } finally {
                                        setIsTesting(false);
                                    }
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}
                            >
                                {isTesting
                                    ? <span className="spinner" style={{ width: '14px', height: '14px' }} />
                                    : '📤'
                                }
                                {isTesting ? 'Sending...' : (t('test_notification') || 'Send Test Message')}
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`btn ${saveSuccess ? 'btn-success' : 'btn-primary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s ease', marginTop: '2rem' }}
                    >
                        <Save size={16} />
                        {saveSuccess ? '✓ Saved' : t('save_settings')}
                    </button>
                </form>

                {/* Діалог підтвердження оновлення */}
                <ConfirmModal
                    isOpen={confirmUpdate}
                    message="The server will restart to apply the update. Continue?"
                    onConfirm={doApplyUpdate}
                    onCancel={() => setConfirmUpdate(false)}
                    confirmText="Apply Update"
                    cancelText="Cancel"
                />
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
                    <button type="submit" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock size={16} />
                        {t('change_pass_btn')}
                    </button>
                </form>
            </div>
        </div>
    );
}
