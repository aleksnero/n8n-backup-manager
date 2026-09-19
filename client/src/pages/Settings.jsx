import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Database,
    HardDrive,
    Cloud,
    Bell,
    Lock,
    ArrowRight,
    Save,
    Eye,
    EyeOff,
    Check,
    RotateCcw,
    Sparkles,
    ShieldCheck
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Sheet from '../components/Sheet';
import Switch from '../components/Switch';

/**
 * Скелетон для стану завантаження налаштувань
 */
function SettingsSkeleton() {
    return (
        <div>
            <div className="skeleton skeleton-line" style={{ width: '220px', height: '2.2rem', marginBottom: '1.5rem' }} />
            <div className="settings-grid">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="card skeleton-card" style={{ height: '180px' }}>
                        <div className="skeleton skeleton-line" style={{ width: '50px', height: '50px', borderRadius: 'var(--radius)', marginBottom: '1rem' }} />
                        <div className="skeleton skeleton-line" style={{ width: '60%', height: '1.2rem', marginBottom: '0.5rem' }} />
                        <div className="skeleton skeleton-line" style={{ width: '90%', height: '0.9rem' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Settings() {
    const { t } = useTranslation();
    const toast = useToast();

    // Стан відкриття відповідної виїзної бічної панелі (Sheet)
    // 'database' | 'backup' | 'cloud' | 'notifications' | 'security' | null
    const [activeSheet, setActiveSheet] = useState(null);

    // Основний об'єкт налаштувань
    const [settings, setSettings] = useState({
        n8n_container_name: 'n8n',
        db_container_name: '',
        db_type: 'sqlite',
        db_path: '/home/node/.n8n/database.sqlite',
        db_user: 'n8n',
        db_password: '',
        db_name: 'n8n',
        backup_schedule: 'interval:60',
        backup_retention_count: '10',
        auto_integrity_check: 'true',
        backup_compression: 'false',
        backup_encryption: 'false',
        backup_encryption_key: '',
        storage_location: 'local',
        aws_s3_enabled: 'false',
        cloud_provider: 's3',
        aws_s3_endpoint: '',
        aws_s3_region: '',
        aws_s3_bucket: '',
        aws_s3_access_key: '',
        aws_s3_secret_key: '',
        google_drive_credentials: '',
        google_drive_folder_id: '',
        gdrive_client_id: '',
        gdrive_client_secret: '',
        gdrive_refresh_token: '',
        gdrive_folder_id: '',
        onedrive_client_id: '',
        onedrive_client_secret: '',
        onedrive_refresh_token: '',
        notification_enabled: 'false',
        notification_telegram_token: '',
        notification_telegram_chat_id: '',
        enable_news_feed: 'true'
    });

    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [intervalValue, setIntervalValue] = useState(1);
    const [intervalUnit, setIntervalUnit] = useState('hours'); // 'hours' | 'minutes'

    // Стан для кнопки збереження
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Стани тестування
    const [isTestingNotification, setIsTestingNotification] = useState(false);
    const [isTestingCloud, setIsTestingCloud] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

    // Стан форми зміни пароля
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
    const [passwordMessage, setPasswordMessage] = useState('');

    // Стан видимості паролів
    const [showDbPassword, setShowDbPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showEncryptionKey, setShowEncryptionKey] = useState(false);

    useEffect(() => {
        fetchSettings();
        fetchConnectionStatus();
    }, []);

    // Отримання актуального статусу з'єднань (n8n, база даних, Google Drive, OneDrive, S3)
    const fetchConnectionStatus = async () => {
        try {
            const res = await axios.get('/api/backups/status');
            setConnectionStatus(res.data);
        } catch (e) {
            console.error('Failed to fetch connection status', e);
        }
    };

    // Завантаження актуальних налаштувань із сервера
    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings');
            if (Object.keys(res.data).length > 0) {
                const isCloud = res.data.storage_location === 'cloud' || res.data.aws_s3_enabled === 'true';
                setSettings((prev) => ({
                    ...prev,
                    ...res.data,
                    storage_location: isCloud ? 'cloud' : 'local',
                    aws_s3_enabled: isCloud ? 'true' : 'false'
                }));

                // Парсинг інтервалу для UI
                if (res.data.backup_schedule && res.data.backup_schedule.startsWith('interval:')) {
                    const mins = parseInt(res.data.backup_schedule.split(':')[1], 10);
                    if (mins % 60 === 0) {
                        setIntervalValue(mins / 60);
                        setIntervalUnit('hours');
                    } else {
                        setIntervalValue(mins);
                        setIntervalUnit('minutes');
                    }
                } else {
                    setIntervalValue(1);
                    setIntervalUnit('hours');
                    setSettings((prev) => ({ ...prev, backup_schedule: 'interval:60' }));
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings', error);
            toast.error(t('login_failed') || 'Failed to fetch settings');
        } finally {
            setLoading(false);
        }
    };

    // Обробник змін у полях форми
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings((prev) => {
            const val = type === 'checkbox' ? (checked ? 'true' : 'false') : value;
            const updated = { ...prev, [name]: val };
            // Якщо обрано SQLite, db_container_name очищається, бо він не потрібен
            if (name === 'db_type' && value === 'sqlite') {
                updated.db_container_name = '';
            }
            // Синхронізація storage_location та aws_s3_enabled
            if (name === 'storage_location') {
                updated.aws_s3_enabled = val === 'cloud' ? 'true' : 'false';
            }
            if (name === 'gdrive_folder_id') {
                updated.google_drive_folder_id = val;
            }
            return updated;
        });
    };

    // Оновлення розкладу в хвилинах
    const updateSchedule = (val, unit) => {
        setIntervalValue(val);
        setIntervalUnit(unit);
        const mins = unit === 'hours' ? val * 60 : val;
        setSettings((prev) => ({ ...prev, backup_schedule: `interval:${mins}` }));
    };

    // Збереження всіх налаштувань
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setIsSaving(true);
        try {
            const payload = { ...settings };
            if (payload.db_type === 'sqlite') {
                payload.db_container_name = '';
            }
            await axios.post('/api/settings', payload);

            setSaveSuccess(true);
            fetchConnectionStatus();
            toast.success(t('settings_saved') || 'Settings updated successfully!');
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            toast.error(t('settings_save_error') || ('Error saving settings: ' + error.message));
        } finally {
            setIsSaving(false);
        }
    };

    // Зміна пароля адміністратора
    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordMessage('');
        try {
            await axios.post('/api/auth/change-password', passwordData);
            setPasswordMessage(t('password_changed_success') || 'Password changed successfully!');
            setPasswordData({ currentPassword: '', newPassword: '' });
            toast.success(t('password_changed_success') || 'Password changed successfully!');
        } catch (error) {
            const err = error.response?.data?.message || error.message;
            setPasswordMessage(`${t('password_change_failed') || 'Failed: '} ${err}`);
            toast.error(err);
        }
    };

    // Тестування сповіщення Telegram
    const testNotification = async () => {
        setIsTestingNotification(true);
        try {
            const res = await axios.post('/api/settings/test-notification', {
                telegram_token: settings.notification_telegram_token,
                telegram_chat_id: settings.notification_telegram_chat_id
            });
            if (res.data.ok) {
                toast.success(t('telegram_test_success') || 'Test notification sent!');
            } else {
                toast.error(`${t('telegram_test_failed') || 'Failed to send test: '} ${res.data.error || 'Unknown error'}`);
            }
        } catch (err) {
            toast.error(`${t('telegram_test_failed') || 'Failed to send test: '} ${err.response?.data?.error || err.message}`);
        } finally {
            setIsTestingNotification(false);
        }
    };

    // Миттєве перемикання та збереження налаштування стрічки новин
    const handleNewsFeedToggle = async (e) => {
        const nextVal = e.target.checked ? 'true' : 'false';
        setSettings((prev) => ({ ...prev, enable_news_feed: nextVal }));
        try {
            await axios.post('/api/settings', { enable_news_feed: nextVal });
            toast.success(t('saved') || 'Saved!');
        } catch (err) {
            console.error('Failed to save news feed setting', err);
            toast.error('Failed to save setting: ' + (err.response?.data?.message || err.message));
        }
    };

    // Тестування підключення до хмарного сховища
    const testCloudConnection = async () => {
        const provider = settings.cloud_provider || 's3';
        setIsTestingCloud(true);
        try {
            let credentials = {};
            if (provider === 's3') {
                credentials = {
                    access_key: settings.aws_s3_access_key,
                    secret_key: settings.aws_s3_secret_key,
                    region: settings.aws_s3_region,
                    bucket: settings.aws_s3_bucket,
                    endpoint: settings.aws_s3_endpoint
                };
            } else if (provider === 'gdrive') {
                credentials = {
                    client_id: settings.gdrive_client_id,
                    client_secret: settings.gdrive_client_secret,
                    refresh_token: settings.gdrive_refresh_token,
                    folder_id: settings.gdrive_folder_id
                };
            } else if (provider === 'onedrive') {
                credentials = {
                    client_id: settings.onedrive_client_id,
                    client_secret: settings.onedrive_client_secret,
                    refresh_token: settings.onedrive_refresh_token
                };
            }

            const res = await axios.post('/api/settings/cloud/test', { provider, credentials });
            if (res.data.ok) {
                toast.success(t('cloud_test_success') || 'Connection successful!');
                fetchConnectionStatus();
            } else {
                toast.error(`${t('cloud_test_failed') || 'Connection test failed: '} ${res.data.error || 'Unknown error'}`);
            }
        } catch (err) {
            toast.error(`${t('cloud_test_failed') || 'Connection test failed: '} ${err.response?.data?.error || err.message}`);
        } finally {
            setIsTestingCloud(false);
        }
    };

    // Швидке скидання кешу Service Worker та браузера
    const handleClearAppCache = async () => {
        setIsClearingCache(true);
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((r) => r.unregister()));
            }
            toast.success(t('cache_cleared') || 'Application cache cleared! Reloading...');
            setTimeout(() => {
                window.location.reload(true);
            }, 800);
        } catch (err) {
            toast.error('Failed to clear cache: ' + err.message);
            setIsClearingCache(false);
        }
    };

    if (loading) return <SettingsSkeleton />;

    // Спільний футер для панелей редагування налаштувань
    const renderSheetFooter = () => (
        <>
            <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveSheet(null)}
            >
                {t('close') || 'Close'}
            </button>
            <button
                type="button"
                className="btn btn-primary"
                disabled={isSaving}
                onClick={handleSubmit}
                style={{
                    backgroundColor: saveSuccess ? 'var(--success)' : 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}
            >
                {isSaving ? (
                    <span className="spinner" />
                ) : saveSuccess ? (
                    <Check size={16} />
                ) : (
                    <Save size={16} />
                )}
                {saveSuccess
                    ? (t('saved') || 'Saved!')
                    : isSaving
                        ? (t('saving') || 'Saving...')
                        : (t('save_changes') || 'Save changes')
                }
            </button>
        </>
    );

    return (
        <div>
            {/* Верхній блок заголовка */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⚙️ {t('settings')}
                    </h2>
                </div>
            </div>

            {/* Сітка карток налаштувань */}
            <div className="settings-grid">
                {/* 1. n8n та База даних */}
                <div className="settings-card" onClick={() => setActiveSheet('database')}>
                    <div>
                        <div className="settings-card-top">
                            <div className="settings-card-icon">
                                <Database size={22} />
                            </div>
                            <span className="settings-card-badge accent">
                                {(settings.db_type || 'sqlite').toUpperCase()}
                            </span>
                        </div>
                        <h3 className="settings-card-title">{t('card_n8n_title')}</h3>
                        <p className="settings-card-desc">{t('card_n8n_desc')}</p>
                    </div>
                    <div className="settings-card-action">
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                            }}
                            title={`Container: ${settings.n8n_container_name || 'n8n'}`}
                        >
                            {connectionStatus && (
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        minWidth: 8,
                                        minHeight: 8,
                                        borderRadius: '50%',
                                        backgroundColor: connectionStatus.database ? 'var(--success)' : 'var(--error)',
                                        display: 'inline-block',
                                        flexShrink: 0
                                    }}
                                />
                            )}
                            <span style={{ flexShrink: 0 }}>Container:</span>
                            <strong
                                style={{
                                    display: 'inline-block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                    maxWidth: '100%'
                                }}
                            >
                                {settings.n8n_container_name || 'n8n'}
                            </strong>
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {t('configure_btn')} <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* 2. Розклад та Оптимізація */}
                <div className="settings-card" onClick={() => setActiveSheet('backup')}>
                    <div>
                        <div className="settings-card-top">
                            <div className="settings-card-icon">
                                <HardDrive size={22} />
                            </div>
                            <span className="settings-card-badge success">
                                {intervalValue} {intervalUnit === 'hours' ? t('hours').toLowerCase() : t('minutes').toLowerCase()}
                            </span>
                        </div>
                        <h3 className="settings-card-title">{t('card_backup_title')}</h3>
                        <p className="settings-card-desc">{t('card_backup_desc')}</p>
                    </div>
                    <div className="settings-card-action">
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title={`${settings.backup_retention_count || 10} ${t('backup_retention_count') ? t('backup_retention_count').toLowerCase() : 'copies'} · ${settings.auto_integrity_check === 'true' ? '🛡️ Auto Integrity Check' : 'Manual'}`}
                        >
                            {settings.backup_retention_count || 10} {t('backup_retention_count') ? t('backup_retention_count').toLowerCase() : 'copies'} · {settings.auto_integrity_check === 'true' ? '🛡️ Auto' : 'Manual'}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {t('configure_btn')} <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* 3. Хмарне сховище */}
                <div className="settings-card" onClick={() => setActiveSheet('cloud')}>
                    <div>
                        <div className="settings-card-top">
                            <div className="settings-card-icon">
                                <Cloud size={22} />
                            </div>
                            <span className={`settings-card-badge ${settings.storage_location === 'cloud' ? 'success' : ''}`}>
                                {settings.storage_location === 'cloud'
                                    ? (settings.cloud_provider === 'gdrive' ? 'GOOGLE DRIVE' : settings.cloud_provider === 'onedrive' ? 'ONEDRIVE' : 'S3')
                                    : 'LOCAL'}
                            </span>
                        </div>
                        <h3 className="settings-card-title">{t('card_cloud_title')}</h3>
                        <p className="settings-card-desc">{t('card_cloud_desc')}</p>
                    </div>
                    <div className="settings-card-action">
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title={settings.storage_location === 'cloud' ? `${settings.cloud_provider?.toUpperCase()}` : 'Local only'}
                        >
                            {settings.storage_location === 'cloud' ? (
                                connectionStatus && (
                                    (settings.cloud_provider === 'gdrive' && connectionStatus.gdrive) ||
                                    (settings.cloud_provider === 'onedrive' && connectionStatus.onedrive) ||
                                    (settings.cloud_provider === 's3' && connectionStatus.s3)
                                ) ? (
                                    <>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--success)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('connected') || 'Connected'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--warning)', display: 'inline-block', flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('configured') || 'Configured'}</span>
                                    </>
                                )
                            ) : (
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('local_only') || 'Local only'}</span>
                            )}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {t('configure_btn')} <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* 4. Сповіщення Telegram */}
                <div className="settings-card" onClick={() => setActiveSheet('notifications')}>
                    <div>
                        <div className="settings-card-top">
                            <div className="settings-card-icon">
                                <Bell size={22} />
                            </div>
                            <span className={`settings-card-badge ${settings.notification_enabled === 'true' ? 'success' : ''}`}>
                                {settings.notification_enabled === 'true' ? (t('connected') || 'ACTIVE') : (t('disconnected') || 'OFF')}
                            </span>
                        </div>
                        <h3 className="settings-card-title">{t('card_notifications_title')}</h3>
                        <p className="settings-card-desc">{t('card_notifications_desc')}</p>
                    </div>
                    <div className="settings-card-action">
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title={settings.notification_enabled === 'true' ? `Telegram Bot (Chat ID: ${settings.telegram_chat_id || 'Not set'})` : 'Disabled'}
                        >
                            {settings.notification_enabled === 'true'
                                ? (settings.telegram_chat_id ? `ID: ${settings.telegram_chat_id}` : 'Telegram Bot')
                                : (t('disconnected') || 'Disabled')}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {t('configure_btn')} <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* 5. Безпека та Пароль */}
                <div className="settings-card" onClick={() => setActiveSheet('security')}>
                    <div>
                        <div className="settings-card-top">
                            <div className="settings-card-icon">
                                <Lock size={22} />
                            </div>
                            <span className="settings-card-badge">
                                ADMIN
                            </span>
                        </div>
                        <h3 className="settings-card-title">{t('card_security_title')}</h3>
                        <p className="settings-card-desc">{t('card_security_desc')}</p>
                    </div>
                    <div className="settings-card-action">
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                            title="Password, App Cache & Reset"
                        >
                            Password & App Cache
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {t('configure_btn')} <ArrowRight size={14} />
                        </span>
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ВИЇЗНІ ПАНЕЛІ (SHEETS) ДЛЯ КОЖНОГО РОЗДІЛУ НАЛАШТУВАНЬ    */}
            {/* ========================================================= */}

            {/* SHEET 1: n8n та База даних */}
            <Sheet
                isOpen={activeSheet === 'database'}
                onClose={() => setActiveSheet(null)}
                title={t('card_n8n_title')}
                description={t('card_n8n_desc')}
                icon={<Database size={20} />}
                footer={renderSheetFooter()}
            >
                <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {t('n8n_container')}
                        </label>
                        <input
                            type="text"
                            name="n8n_container_name"
                            value={settings.n8n_container_name}
                            onChange={handleChange}
                            placeholder="n8n"
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>
                            The Docker container name of your n8n service (e.g., n8n).
                        </small>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {t('db_type')}
                        </label>
                        <select name="db_type" value={settings.db_type} onChange={handleChange}>
                            <option value="sqlite">SQLite (Default / Internal)</option>
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    </div>

                    {settings.db_type === 'postgres' && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                {t('db_container')}
                            </label>
                            <input
                                type="text"
                                name="db_container_name"
                                value={settings.db_container_name || ''}
                                onChange={handleChange}
                                placeholder="postgres"
                            />
                            <small style={{ color: 'var(--text-secondary)' }}>
                                The name of your Database docker container (e.g., postgres-1).
                            </small>
                        </div>
                    )}

                    {settings.db_type === 'sqlite' ? (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                {t('db_path')}
                            </label>
                            <input
                                type="text"
                                name="db_path"
                                value={settings.db_path}
                                onChange={handleChange}
                            />
                            <small style={{ color: 'var(--text-secondary)' }}>
                                Path inside n8n container (e.g., /home/node/.n8n/database.sqlite).
                            </small>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('db_user')}
                                </label>
                                <input
                                    type="text"
                                    name="db_user"
                                    value={settings.db_user}
                                    onChange={handleChange}
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('db_password')}
                                </label>
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
                                        {showDbPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('db_name')}
                                </label>
                                <input
                                    type="text"
                                    name="db_name"
                                    value={settings.db_name}
                                    onChange={handleChange}
                                />
                            </div>
                        </>
                    )}

                    {/* Стрічка новин та анонсів проекту */}
                    <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                    {t('enable_news_feed')}
                                </label>
                                <small style={{ color: 'var(--text-secondary)', display: 'block', lineHeight: 1.4 }}>
                                    {t('enable_news_feed_desc')}
                                </small>
                            </div>
                            <Switch
                                id="enable_news_feed_sheet1"
                                name="enable_news_feed"
                                checked={settings.enable_news_feed !== 'false'}
                                onChange={handleNewsFeedToggle}
                            />
                        </div>
                    </div>
                </div>
            </Sheet>

            {/* SHEET 2: Розклад та Оптимізація */}
            <Sheet
                isOpen={activeSheet === 'backup'}
                onClose={() => setActiveSheet(null)}
                title={t('card_backup_title')}
                description={t('card_backup_desc')}
                icon={<HardDrive size={20} />}
                footer={renderSheetFooter()}
            >
                <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {t('backup_schedule_interval')}
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                type="number"
                                min="1"
                                value={intervalValue}
                                onChange={(e) => updateSchedule(parseInt(e.target.value, 10) || 1, intervalUnit)}
                                style={{ flex: 1 }}
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {t('backup_retention_count')}
                        </label>
                        <input
                            type="number"
                            name="backup_retention_count"
                            value={settings.backup_retention_count}
                            onChange={handleChange}
                        />
                        <small style={{ color: 'var(--text-secondary)' }}>{t('retention_help')}</small>
                    </div>

                    <h4 style={{ margin: '1.75rem 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        🛡️ {t('auto_integrity_check') || 'Integrity & Security'}
                    </h4>

                    {/* Автоматична перевірка цілісності */}
                    <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('auto_integrity_check')}</div>
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                                {t('auto_integrity_check_help')}
                            </small>
                        </div>
                        <Switch
                            id="auto_integrity_check"
                            name="auto_integrity_check"
                            checked={settings.auto_integrity_check === 'true'}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Стиснення Gzip */}
                    <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Compress Backups (Gzip)</div>
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                                Reduces storage space but takes slightly longer to backup/restore.
                            </small>
                        </div>
                        <Switch
                            id="backup_compression"
                            name="backup_compression"
                            checked={settings.backup_compression === 'true'}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Шифрування AES-256 */}
                    <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Encrypt Backups (AES-256)</div>
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                                Protects your data with a master key. <strong>Do not lose your key!</strong>
                            </small>
                        </div>
                        <Switch
                            id="backup_encryption"
                            name="backup_encryption"
                            checked={settings.backup_encryption === 'true'}
                            onChange={handleChange}
                        />
                    </div>

                    {settings.backup_encryption === 'true' && (
                        <div style={{ marginBottom: '1.5rem', paddingLeft: '1.25rem', borderLeft: '2px solid var(--accent)' }}>
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
                                    {showEncryptionKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Sheet>

            {/* SHEET 3: Хмарне сховище */}
            <Sheet
                isOpen={activeSheet === 'cloud'}
                onClose={() => setActiveSheet(null)}
                title={t('card_cloud_title')}
                description={t('card_cloud_desc')}
                icon={<Cloud size={20} />}
                footer={renderSheetFooter()}
            >
                <div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {t('storage_location')}
                        </label>
                        <select name="storage_location" value={settings.storage_location} onChange={handleChange}>
                            <option value="local">Local Only</option>
                            <option value="cloud">Cloud Storage</option>
                        </select>
                    </div>

                    {settings.storage_location === 'cloud' && (
                        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('cloud_provider')}
                                </label>
                                <select
                                    name="cloud_provider"
                                    value={settings.cloud_provider || 's3'}
                                    onChange={handleChange}
                                >
                                    <option value="s3">Amazon S3 / S3 Compatible</option>
                                    <option value="gdrive">Google Drive</option>
                                    <option value="onedrive">Microsoft OneDrive</option>
                                </select>
                            </div>

                            {/* S3 Налаштування */}
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
                                            placeholder="my-n8n-backups"
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

                            {/* Google Drive Налаштування */}
                            {settings.cloud_provider === 'gdrive' && (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_client_id') || 'OAuth2 Client ID'}
                                        </label>
                                        <input
                                            type="text"
                                            name="gdrive_client_id"
                                            value={settings.gdrive_client_id || ''}
                                            onChange={handleChange}
                                            placeholder="xxxxxx.apps.googleusercontent.com"
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_client_secret') || 'OAuth2 Client Secret'}
                                        </label>
                                        <input
                                            type="password"
                                            name="gdrive_client_secret"
                                            value={settings.gdrive_client_secret || ''}
                                            onChange={handleChange}
                                            placeholder="GOCSPX-••••••••••••••••••••••••••••"
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_refresh_token') || 'OAuth2 Refresh Token'}
                                        </label>
                                        <input
                                            type="password"
                                            name="gdrive_refresh_token"
                                            value={settings.gdrive_refresh_token || ''}
                                            onChange={handleChange}
                                            placeholder="1//••••••••••••••••••••••••••••••••"
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('gdrive_folder_id') || 'Folder ID (optional)'}
                                        </label>
                                        <input
                                            type="text"
                                            name="gdrive_folder_id"
                                            value={settings.gdrive_folder_id || ''}
                                            onChange={handleChange}
                                            placeholder="1ayGB4GZD3S13aPu0Mm1_pAyRBdv_3fy2"
                                        />
                                        <small style={{ color: 'var(--text-secondary)' }}>
                                            {t('gdrive_folder_id_hint') || 'Google Drive folder ID from URL after /folders/. Leave empty for root.'}
                                        </small>
                                    </div>
                                </>
                            )}

                            {/* OneDrive Налаштування */}
                            {settings.cloud_provider === 'onedrive' && (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                                            {t('od_client_id') || 'Client ID'}
                                        </label>
                                        <input
                                            type="text"
                                            name="onedrive_client_id"
                                            value={settings.onedrive_client_id || ''}
                                            onChange={handleChange}
                                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                        />
                                    </div>
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
                                    </div>
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
                                    </div>
                                </>
                            )}

                            {/* Кнопка тестування підключення до хмари */}
                            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={isTestingCloud}
                                    onClick={testCloudConnection}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                                >
                                    {isTestingCloud ? (
                                        <span className="spinner" />
                                    ) : (
                                        <Cloud size={16} />
                                    )}
                                    {isTestingCloud
                                        ? (t('testing_cloud') || 'Testing connection...')
                                        : (t('test_cloud_connection') || 'Test Cloud Connection')
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Sheet>

            {/* SHEET 4: Сповіщення Telegram */}
            <Sheet
                isOpen={activeSheet === 'notifications'}
                onClose={() => setActiveSheet(null)}
                title={t('card_notifications_title')}
                description={t('card_notifications_desc')}
                icon={<Bell size={20} />}
                footer={renderSheetFooter()}
            >
                <div>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('enable_notifications')}</div>
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                                Send automated alerts on backup creation, semantic integrity checks, and failures.
                            </small>
                        </div>
                        <Switch
                            id="notification_enabled"
                            name="notification_enabled"
                            checked={settings.notification_enabled === 'true'}
                            onChange={handleChange}
                        />
                    </div>

                    {settings.notification_enabled === 'true' && (
                        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('telegram_bot_token')}
                                </label>
                                <input
                                    type="password"
                                    name="notification_telegram_token"
                                    value={settings.notification_telegram_token || ''}
                                    onChange={handleChange}
                                    placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>{t('telegram_bot_token_help')}</small>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    {t('telegram_chat_id')}
                                </label>
                                <input
                                    type="text"
                                    name="notification_telegram_chat_id"
                                    value={settings.notification_telegram_chat_id || ''}
                                    onChange={handleChange}
                                    placeholder="987654321 або -1001234567890"
                                />
                                <small style={{ color: 'var(--text-secondary)' }}>{t('telegram_chat_id_help')}</small>
                            </div>

                            {/* Кнопка тестового сповіщення */}
                            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={isTestingNotification || !settings.notification_telegram_token || !settings.notification_telegram_chat_id}
                                    onClick={testNotification}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                                >
                                    {isTestingNotification ? (
                                        <span className="spinner" />
                                    ) : (
                                        <Bell size={16} />
                                    )}
                                    {isTestingNotification ? (t('sending') || 'Sending...') : (t('test_notification') || 'Send Test Notification')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Sheet>

            {/* SHEET 5: Безпека та Пароль */}
            <Sheet
                isOpen={activeSheet === 'security'}
                onClose={() => setActiveSheet(null)}
                title={t('card_security_title')}
                description={t('card_security_desc')}
                icon={<Lock size={20} />}
                footer={
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setActiveSheet(null)}
                    >
                        {t('close') || 'Close'}
                    </button>
                }
            >
                <div>
                    {/* Форма зміни пароля */}
                    <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem' }}>
                        <h4 style={{ margin: '0 0 1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                            {t('change_password')}
                        </h4>

                        {passwordMessage && (
                            <div style={{
                                padding: '0.75rem',
                                borderRadius: 'var(--radius)',
                                marginBottom: '1rem',
                                backgroundColor: passwordMessage.includes('successfully') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: passwordMessage.includes('successfully') ? 'var(--success)' : 'var(--error)',
                                fontSize: '0.875rem'
                            }}>
                                {passwordMessage}
                            </div>
                        )}

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                {t('current_password')}
                            </label>
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
                                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                {t('new_password')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    required
                                    minLength="6"
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
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            <Lock size={16} />
                            {t('change_password')}
                        </button>
                    </form>

                    {/* Стрічка новин та анонсів проекту */}
                    <div style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                    {t('enable_news_feed')}
                                </label>
                                <small style={{ color: 'var(--text-secondary)', display: 'block', lineHeight: 1.4, fontSize: '0.82rem' }}>
                                    {t('enable_news_feed_desc')}
                                </small>
                            </div>
                            <Switch
                                id="enable_news_feed_sheet5"
                                name="enable_news_feed"
                                checked={settings.enable_news_feed !== 'false'}
                                onChange={handleNewsFeedToggle}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isSaving}
                                onClick={handleSubmit}
                                style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Save size={14} />
                                <span>{isSaving ? (t('saving') || 'Saving...') : (t('save_changes') || 'Save changes')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Інструмент швидкого очищення кешу браузера */}
                    <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <RotateCcw size={18} color="var(--accent)" />
                            <h4 style={{ margin: 0 }}>{t('clear_cache')}</h4>
                        </div>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {t('clear_cache_desc')}
                        </p>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isClearingCache}
                            onClick={handleClearAppCache}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                        >
                            {isClearingCache ? (
                                <span className="spinner" />
                            ) : (
                                <RotateCcw size={16} />
                            )}
                            {isClearingCache ? (t('loading') || 'Clearing...') : t('clear_cache')}
                        </button>
                    </div>
                </div>
            </Sheet>
        </div>
    );
}
