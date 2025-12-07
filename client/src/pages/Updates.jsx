import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, Download, RotateCcw, Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function Updates() {
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
            setError('Не вдалося перевірити оновлення: ' + err.message);
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
        if (!confirm('Застосувати оновлення? Сервер буде перезапущено.')) return;

        setLoading(true);
        setError('');
        try {
            await axios.post('/api/updates/apply');
            alert('Оновлення застосовано! Сервер перезапускається...');
            // Wait for server restart
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        } catch (err) {
            setError('Не вдалося застосувати оновлення: ' + err.response?.data?.message || err.message);
            setLoading(false);
        }
    };

    const rollback = async () => {
        if (!confirm('Відкотити до попередньої версії? Сервер буде перезапущено.')) return;

        setLoading(true);
        setError('');
        try {
            await axios.post('/api/updates/rollback');
            alert('Rollback виконано! Сервер перезапускається...');
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        } catch (err) {
            setError('Не вдалося виконати rollback: ' + err.response?.data?.message || err.message);
            setLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Оновлення</h1>
                <button
                    onClick={checkForUpdates}
                    disabled={checking}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <RefreshCw size={16} className={checking ? 'spinning' : ''} />
                    {checking ? 'Перевірка...' : 'Перевірити оновлення'}
                </button>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--error)' }}>
                        <AlertCircle size={24} />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Current Version */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Поточна версія</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius)',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        fontFamily: 'monospace'
                    }}>
                        v{updateInfo?.currentVersion || '1.1.0'}
                    </div>
                    {updateInfo && !updateInfo.hasUpdate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                            <CheckCircle size={20} />
                            <span>Ви використовуєте останню версію</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Available Update */}
            {updateInfo?.hasUpdate && (
                <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Доступне оновлення</h3>
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: 'var(--accent)',
                                fontFamily: 'monospace'
                            }}>
                                v{updateInfo.remoteVersion}
                            </div>
                            {updateInfo.releaseDate && (
                                <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={16} />
                                    {new Date(updateInfo.releaseDate).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={applyUpdate}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Download size={16} />
                            {loading ? 'Застосування...' : 'Застосувати оновлення'}
                        </button>
                    </div>

                    {updateInfo.releaseNotes && (
                        <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Опис релізу:</h4>
                            <p style={{ color: 'var(--text-secondary)' }}>{updateInfo.releaseNotes}</p>
                        </div>
                    )}

                    {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                        <div>
                            <h4 style={{ marginBottom: '0.5rem' }}>Зміни:</h4>
                            <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                                {updateInfo.changelog.map((item, index) => (
                                    <li key={index} style={{ marginBottom: '0.25rem' }}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Rollback */}
            {history.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Відкат до попередньої версії</h3>
                        <button
                            onClick={rollback}
                            disabled={loading}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)' }}
                        >
                            <RotateCcw size={16} />
                            Rollback
                        </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Доступна резервна копія: v{history[0].version}
                    </p>
                </div>
            )}

            {/* Update History */}
            {history.length > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>Історія оновлень</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Версія</th>
                                    <th>Дата</th>
                                    <th>Розмір</th>
                                    <th>Файл</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontWeight: 'bold',
                                                color: index === 0 ? 'var(--accent)' : 'inherit'
                                            }}>
                                                v{item.version}
                                            </span>
                                        </td>
                                        <td>{item.date.toLocaleString()}</td>
                                        <td>{formatBytes(item.size)}</td>
                                        <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {item.filename}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style>{`
                .spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
