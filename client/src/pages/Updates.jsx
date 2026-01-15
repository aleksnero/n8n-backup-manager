import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, RotateCcw, Clock, AlertCircle, CheckCircle, Trash2, ArrowLeft, Archive, HardDrive } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function Updates() {
    const { t } = useTranslation();
    const [updateInfo, setUpdateInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        checkForUpdates();
        fetchHistory();
    }, []);

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

    const applyUpdate = async () => {
        if (!confirm(t('confirm_update'))) return;

        setLoading(true);
        setError('');
        try {
            await axios.post('/api/updates/apply');
            alert(t('update_success'));
            // Wait for server restart
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(t('update_error') + errorMsg);
            setLoading(false);
        }
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
            link.parentNode.removeChild(link);
        } catch (err) {
            alert(t('upload_failed') + (err.response?.data?.message || err.message));
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
            alert(t('upload_success'));
            fetchHistory();
        } catch (err) {
            alert(t('upload_failed') + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
            e.target.value = null; // Reset input
        }
    };

    const rollbackToVersion = async (filename) => {
        if (!confirm(t('confirm_rollback_version'))) return;

        setLoading(true);
        setError('');
        try {
            await axios.post('/api/updates/rollback', { filename });
            alert(t('rollback_success'));
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(t('update_error') + errorMsg);
            setLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    const deleteHistoryItem = async (filename) => {
        if (!confirm(t('confirm_delete_backup'))) return;
        try {
            await axios.delete(`/api/updates/history/${filename}`);
            fetchHistory();
        } catch (err) {
            alert(t('update_error') + err.message);
        }
    };

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
                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>{t('current_version')}</h4>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            v{updateInfo?.currentVersion || '1.1.0'}
                        </div>
                    </div>

                    {/* New Version Info */}
                    {updateInfo?.hasUpdate && updateInfo?.currentVersion !== updateInfo?.remoteVersion ? (
                        <div style={{ flex: 1 }}>
                            <h4 style={{ color: 'var(--accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>{t('available_update')}</h4>
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
                                    <Download size={16} />
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
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('latest_version_msg')}</p>
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

                        {updateInfo.changelog && updateInfo.changelog.length > 0 && (
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

            {/* Local Backups / History */}
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Archive size={20} />
                {t('update_history')}
            </h3>

            {
                history.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <HardDrive size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p>{t('no_backups_found')}</p>
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
                                                {index === 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)' }}>({t('latest')})</span>}
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
                )
            }

            <style>{`
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    );
}
