import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Download, RotateCcw, Trash2, Shield, HardDrive, Cloud, Database, Search } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import IntegrityBadge from '../components/IntegrityBadge';

// Skeleton для таблиці бекапів
function BackupsSkeleton() {
    return (
        <div>
            <div className="skeleton skeleton-line" style={{ width: '150px', height: '2rem', marginBottom: '1.5rem' }} />
            {/* Рядок фільтрів */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="skeleton skeleton-line" style={{ flex: 2, height: '2.4rem', borderRadius: 'var(--radius)' }} />
                <div className="skeleton skeleton-line" style={{ width: '130px', height: '2.4rem', borderRadius: 'var(--radius)' }} />
                <div className="skeleton skeleton-line" style={{ width: '150px', height: '2.4rem', borderRadius: 'var(--radius)' }} />
            </div>
            <div className="skeleton-card">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="skeleton skeleton-line" style={{ flex: 3 }} />
                        <div className="skeleton skeleton-line" style={{ flex: 2 }} />
                        <div className="skeleton skeleton-line" style={{ flex: 1 }} />
                        <div className="skeleton skeleton-line" style={{ flex: 1 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Backups() {
    const { t } = useTranslation();
    const toast = useToast();
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);

    // Стани фільтрів
    const [searchText, setSearchText] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest');

    // Стан для модального вікна підтвердження
    const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null, danger: false });

    useEffect(() => {
        fetchBackups();
    }, []);

    const fetchBackups = async () => {
        try {
            const res = await axios.get('/api/backups');
            setBackups(res.data);
        } catch (error) {
            console.error('Failed to fetch backups', error);
        } finally {
            setLoading(false);
        }
    };

    // Фільтрований і відсортований список — перераховується лише при зміні залежностей
    const filteredBackups = useMemo(() => {
        let result = [...backups];

        // Фільтр за типом
        if (typeFilter !== 'all') {
            result = result.filter(b => b.type === typeFilter);
        }

        // Пошук по назві файлу або label
        if (searchText.trim()) {
            const q = searchText.toLowerCase();
            result = result.filter(b =>
                b.filename.toLowerCase().includes(q) ||
                (b.label && b.label.toLowerCase().includes(q))
            );
        }

        // Сортування за датою
        result.sort((a, b) => {
            const diff = new Date(b.createdAt) - new Date(a.createdAt);
            return sortOrder === 'newest' ? diff : -diff;
        });

        return result;
    }, [backups, searchText, typeFilter, sortOrder]);

    // Відкриває кастомний діалог підтвердження
    const openConfirm = (message, onConfirm, danger = false) => {
        setConfirm({ open: true, message, onConfirm, danger });
    };

    const closeConfirm = () => {
        setConfirm({ open: false, message: '', onConfirm: null, danger: false });
    };

    const handleRestore = (id) => {
        openConfirm(
            t('confirm_restore'),
            async () => {
                closeConfirm();
                try {
                    await axios.post(`/api/backups/${id}/restore`);
                    toast.success('Restore started successfully!');
                } catch (error) {
                    toast.error('Restore failed: ' + (error.response?.data?.message || error.message));
                }
            }
        );
    };

    const handleDelete = (id) => {
        openConfirm(
            t('confirm_delete'),
            async () => {
                closeConfirm();
                try {
                    await axios.delete(`/api/backups/${id}`);
                    fetchBackups();
                    toast.success('Backup deleted.');
                } catch (error) {
                    toast.error('Delete failed: ' + (error.response?.data?.message || error.message));
                }
            },
            true // danger = червона кнопка
        );
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await axios.get(`/api/backups/${id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Download failed');
        }
    };

    const handleToggleProtection = async (id, currentStatus) => {
        try {
            await axios.patch(`/api/backups/${id}/protect`, { isProtected: !currentStatus });
            fetchBackups();
            toast.info(currentStatus ? 'Protection removed.' : 'Backup protected.');
        } catch (error) {
            toast.error('Failed to toggle protection: ' + (error.response?.data?.message || error.message));
        }
    };

    const renderStorageIcons = (location) => {
        if (!location) location = 'local';
        const locations = location.split(',');
        return (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {locations.includes('local')   && <HardDrive size={16} title="Local"         color="var(--text-secondary)" />}
                {locations.includes('gdrive')  && <Cloud     size={16} title="Google Drive"  color="#4285F4" />}
                {locations.includes('onedrive')&& <Cloud     size={16} title="OneDrive"      color="#0078D4" />}
                {locations.includes('s3')      && <Cloud     size={16} title="S3"            color="var(--warning)" />}
            </div>
        );
    };

    if (loading) return <BackupsSkeleton />;

    return (
        <div>
            <h1 style={{ marginBottom: '1.5rem' }}>{t('backups_title')}</h1>

            {/* Рядок фільтрів */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search
                        size={16}
                        style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}
                    />
                    <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        placeholder={t('search_placeholder')}
                        style={{ paddingLeft: '2.25rem' }}
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    style={{ width: '140px', flexShrink: 0 }}
                >
                    <option value="all">{t('all_types')}</option>
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                    <option value="upload">Upload</option>
                </select>
                <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                    style={{ width: '160px', flexShrink: 0 }}
                >
                    <option value="newest">{t('sort_newest')}</option>
                    <option value="oldest">{t('sort_oldest')}</option>
                </select>
            </div>

            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                {filteredBackups.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>{t('filename')}</th>
                                <th>{t('label_col')}</th>
                                <th>{t('date_col')}</th>
                                <th>{t('size_col')}</th>
                                <th>{t('type')}</th>
                                <th>{t('storage')}</th>
                                <th>{t('integrity') || 'Integrity'}</th>
                                <th>{t('protected')}</th>
                                <th>{t('actions_col')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBackups.map((backup) => (
                                <tr key={backup.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{backup.filename}</td>
                                    <td style={{ color: backup.label ? 'var(--text-primary)' : 'var(--text-secondary)', fontStyle: backup.label ? 'normal' : 'italic', fontSize: '0.9rem' }}>
                                        {backup.label || '—'}
                                    </td>
                                    <td>{new Date(backup.createdAt).toLocaleString()}</td>
                                    <td>{(backup.size / 1024 / 1024).toFixed(2)} MB</td>
                                    <td>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: 'var(--radius)',
                                            backgroundColor: backup.type === 'auto' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 75, 113, 0.1)',
                                            color: backup.type === 'auto' ? 'var(--success)' : 'var(--accent)',
                                            fontSize: '0.875rem',
                                        }}>
                                            {backup.type}
                                        </span>
                                    </td>
                                    <td>{renderStorageIcons(backup.storageLocation)}</td>
                                    <td>
                                        <IntegrityBadge backupId={backup.id} />
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleToggleProtection(backup.id, backup.isProtected)}
                                            className="btn btn-secondary"
                                            title={backup.isProtected ? t('protected') : t('not_protected')}
                                            style={{ color: backup.isProtected ? 'var(--success)' : 'var(--text-secondary)', padding: '0.5rem' }}
                                        >
                                            <Shield size={16} fill={backup.isProtected ? 'currentColor' : 'none'} />
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleDownload(backup.id, backup.filename)} className="btn btn-secondary" title={t('download')}>
                                                <Download size={16} />
                                            </button>
                                            <button onClick={() => handleRestore(backup.id)} className="btn btn-secondary" title={t('restore')}>
                                                <RotateCcw size={16} />
                                            </button>
                                            <button
                                                onClick={() => !backup.isProtected && handleDelete(backup.id)}
                                                className="btn btn-secondary"
                                                style={{ color: backup.isProtected ? 'var(--text-secondary)' : 'var(--error)', opacity: backup.isProtected ? 0.5 : 1, cursor: backup.isProtected ? 'not-allowed' : 'pointer' }}
                                                title={backup.isProtected ? t('unprotect_to_delete') : t('delete')}
                                                disabled={backup.isProtected}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    /* Порожній стан — різний залежно від того чи є фільтр */
                    <EmptyState
                        icon={<Database size={48} />}
                        title={searchText || typeFilter !== 'all' ? t('no_backups_filtered') : t('no_backups')}
                        description={searchText || typeFilter !== 'all' ? t('no_backups_filtered_desc') : t('no_backups_desc')}
                    />
                )}
            </div>

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
