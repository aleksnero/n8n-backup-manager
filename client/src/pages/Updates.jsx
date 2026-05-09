import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, RotateCcw, Clock, AlertCircle, CheckCircle, Trash2, Archive, HardDrive } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';

// Skeleton під час першого завантаження
function UpdatesSkeleton() {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="skeleton skeleton-line" style={{ width: '160px', height: '2rem' }} />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="skeleton skeleton-line" style={{ width: '160px', height: '2.4rem', borderRadius: 'var(--radius)' }} />
                    <div className="skeleton skeleton-line" style={{ width: '140px', height: '2.4rem', borderRadius: 'var(--radius)' }} />
                </div>
            </div>
            <div className="skeleton-card" style={{ marginBottom: '2rem' }}>
                <div className="skeleton skeleton-line" style={{ width: '120px', marginBottom: '1rem' }} />
                <div className="skeleton skeleton-line" style={{ width: '200px', height: '3rem', marginBottom: '0.5rem' }} />
                <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            </div>
        </div>
    );
}

export default function Updates() {
    const { t } = useTranslation();
    const toast = useToast();
    const [updateInfo, setUpdateInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true); // true — одразу перевіряємо
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');

    // Стани для кастомних модалів підтвердження
    const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null, danger: false });

    useEffect(() => {
        checkForUpdates();
        fetchHistory();
    }, []);

    const openConfirm = (message, onConfirm, danger = false) => {
        setConfirm({ open: true, message, onConfirm, danger });
    };

    const closeConfirm = () => {
        setConfirm({ open: false, message: '', onConfirm: null, danger: false });
    };

    const checkForUpdates = async () => {
        setChecking(true);
        setError('');
        try {
            const response = await axios.get('/api/updates/check');
            setUpdateInfo(response.data);
        } catch (err) {
            setError(t('update_error') + err.message);
        } finally {
            setChecking(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await axios.get('/api/updates/history');
            setHistory(response.data);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    };

    const applyUpdate = () => {
        openConfirm(
            t('confirm_update'),
            async () => {
                closeConfirm();
                setLoading(true);
                setError('');
                try {
                    await axios.post('/api/updates/apply');
                    toast.success(t('update_success'));
                    // Сервер перезапускається — чекаємо і перезавантажуємо сторінку
                    setTimeout(() => window.location.reload(), 5000);
                } catch (err) {
                    const errorMsg = err.response?.data?.message || err.message;
                    setError(t('update_error') + errorMsg);
                    setLoading(false);
                }
            }
        );
    };

    const downloadBackup = async (filename) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`/api/updates/download/${filename}`, {
                responseType: 'blob',
                headers: { 'x-access-token': token }
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(t('upload_failed') + (err.response?.data?.message || err.message));
        }
    };

    const uploadBackup = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        try {
            await axios.post('/api/updates/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(t('upload_success'));
            fetchHistory();
        } catch (err) {
            toast.error(t('upload_failed') + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
            e.target.value = null;
        }
    };

    const rollbackToVersion = (filename) => {
        openConfirm(
            t('confirm_rollback_version'),
            async () => {
                closeConfirm();
                setLoading(true);
                setError('');
                try {
                    await axios.post('/api/updates/rollback', { filename });
                    toast.success(t('rollback_success'));
                    setTimeout(() => window.location.reload(), 5000);
                } catch (err) {
                    const errorMsg = err.response?.data?.message || err.message;
                    setError(t('update_error') + errorMsg);
                    setLoading(false);
                }
            },
            true // danger — червона кнопка
        );
    };

    const deleteHistoryItem = (filename) => {
        openConfirm(
            t('confirm_delete_backup'),
            async () => {
                closeConfirm();
                try {
                    await axios.delete(`/api/updates/history/${filename}`);
                    fetchHistory();
                    toast.success(t('delete') + ' OK');
                } catch (err) {
                    toast.error(t('update_error') + err.message);
                }
            },
            true
        );
    };

    const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    if (checking && !updateInfo) return <UpdatesSkeleton />;

    return (
        <div className="updates-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ margin: 0 }}>{t('updates_title')}</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={checkForUpdates}
                        disabled={checking}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <RefreshCw size={16} className={checking ? 'spinning' : ''} />
                        {checking ? t('checking') : t('check_updates')}
                    </button>
                    <label className="btn btn-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--warning)', color: '#000', cursor: 'pointer', margin: 0 }}>
                        <Download size={16} />
                        {t('upload_update')}
                        <input type="file" accept=".zip" onChange={uploadBackup} style={{ display: 'none' }} />
                    </label>
                </div>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--error)' }}>
                        <AlertCircle size={24} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Current & Update Status Block */}
            <div className="card" style={{ marginBottom: '2rem', borderLeft: updateInfo?.hasUpdate ? '5px solid var(--accent)' : '5px solid var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                    {/* Current Version */}
                    <div>
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>
                            {t('current_version')}
                        </h4>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            v{updateInfo?.currentVersion || '—'}
                        </div>
                    </div>

                    {/* New Version / Up to date */}
                    {updateInfo?.hasUpdate && updateInfo?.currentVersion !== updateInfo?.remoteVersion ? (
                        <div style={{ flex: 1 }}>
                            <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>
                                {t('available_update')}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent)' }}>
                                    v{updateInfo.remoteVersion}
                                </div>
                                <button
                                    onClick={applyUpdate}
                                    disabled={loading}
                                    className="btn btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    {loading ? <span className="spinner" /> : <Download size={16} />}
                                    {loading ? t('applying') : t('apply_update')}
                                </button>
                            </div>
                            {updateInfo.releaseDate && (
                                <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={16} />
                                    {new Date(updateInfo.releaseDate).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '0.5rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)' }}>
                                <CheckCircle size={32} color="var(--success)" />
                            </div>
                            <div>
                                <h4 style={{ marginBottom: '0.25rem' }}>{t('latest_version_msg')}</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>{t('latest_version_msg')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Changelog */}
                {updateInfo?.hasUpdate && (
                    <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                        {updateInfo.releaseNotes && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ marginBottom: '0.5rem' }}>{t('release_notes')}</h4>
                                <p style={{ color: 'var(--text-secondary)' }}>{updateInfo.releaseNotes}</p>
                            </div>
                        )}
                        {updateInfo.changelog?.length > 0 && (
                            <div>
                                <h4 style={{ marginBottom: '0.5rem' }}>{t('changelog')}</h4>
                                <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                                    {updateInfo.changelog.map((item, index) => (
                                        <li key={index} style={{ marginBottom: '0.25rem' }}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Update History */}
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Archive size={20} />
                {t('update_history')}
            </h3>

            {history.length === 0 ? (
                <div className="card">
                    <EmptyState
                        icon={<HardDrive size={48} />}
                        title={t('no_backups_found')}
                    />
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--bg-secondary)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{t('version_col')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{t('date_col')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{t('size_col')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>{t('file_col')}</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>{t('actions_col')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontWeight: 'bold',
                                                color: index === 0 ? 'var(--accent)' : 'inherit',
                                                background: index === 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px'
                                            }}>
                                                v{item.version}
                                            </span>
                                            {index === 0 && (
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)' }}>
                                                    ({t('latest')})
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>{new Date(item.date).toLocaleString()}</td>
                                        <td style={{ padding: '1rem' }}>{formatBytes(item.size)}</td>
                                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {item.filename}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => downloadBackup(item.filename)}
                                                    className="btn btn-sm"
                                                    title={t('download_update')}
                                                    style={{ color: 'var(--accent)', background: 'transparent', padding: '0.5rem' }}
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button
                                                    onClick={() => rollbackToVersion(item.filename)}
                                                    className="btn btn-sm"
                                                    title={t('rollback_btn')}
                                                    disabled={loading}
                                                    style={{ color: 'var(--warning)', background: 'transparent', padding: '0.5rem' }}
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deleteHistoryItem(item.filename)}
                                                    className="btn btn-sm"
                                                    title={t('delete')}
                                                    style={{ color: 'var(--error)', background: 'transparent', padding: '0.5rem' }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Кастомний діалог підтвердження */}
            <ConfirmModal
                isOpen={confirm.open}
                message={confirm.message}
                onConfirm={confirm.onConfirm}
                onCancel={closeConfirm}
                confirmText={t('confirm_btn')}
                cancelText={t('cancel_btn')}
                danger={confirm.danger}
            />
        </div>
    );
}
