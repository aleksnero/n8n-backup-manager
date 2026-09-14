import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Workflow,
    Layers,
    Key,
    Clock,
    RotateCcw,
    Download,
    Trash2,
    Shield,
    HardDrive,
    Cloud,
    Search,
    RefreshCw,
    Play,
    Plus,
    CheckCircle2,
    XCircle,
    Calendar,
    Settings,
    FileText
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import Sheet from '../components/Sheet';
import EmptyState from '../components/EmptyState';
import Switch from '../components/Switch';

/**
 * Сторінка керування гранулярними снапшотами окремих робочих процесів та їх облікових даних n8n.
 * Дозволяє безпечно зберігати, переносити та відкочувати окремі воркфлоу наживо без переривання роботи n8n.
 */
export default function WorkflowSnapshots() {
    const { t } = useTranslation();
    const toast = useToast();

    // Дані
    const [liveWorkflows, setLiveWorkflows] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Активна вкладка: 'workflows' (живі процеси n8n) або 'snapshots' (збережені снапшоти)
    const [activeTab, setActiveTab] = useState('workflows');

    // Фільтри та пошук
    const [wfSearch, setWfSearch] = useState('');
    const [wfStatusFilter, setWfStatusFilter] = useState('all'); // all, active, inactive
    const [snapSearch, setSnapSearch] = useState('');
    const [snapWfFilter, setSnapWfFilter] = useState('all');

    // Стан створення снапшоту
    const [createModal, setCreateModal] = useState({ open: false, workflow: null, note: '', loading: false });

    // Стан відновлення / відкату (Rollback)
    const [rollbackModal, setRollbackModal] = useState({ open: false, snapshot: null, loading: false });

    // Стан підтвердження видалення
    const [deleteModal, setDeleteModal] = useState({ open: false, snapshot: null, loading: false });

    // Стан виїзної бічної панелі налаштувань авто-розкладу
    const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
    const [scheduleConfig, setScheduleConfig] = useState({
        enabled: false,
        schedule: 'interval:360',
        scope: 'all_active',
        retention: 5,
        saving: false
    });

    useEffect(() => {
        loadAllData();
        loadScheduleConfig();
    }, []);

    // Одночасне завантаження живих воркфлоу з n8n та збережених снапшотів
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [wfRes, snapRes] = await Promise.all([
                axios.get('/api/workflow-snapshots/live'),
                axios.get('/api/workflow-snapshots')
            ]);
            setLiveWorkflows(wfRes.data || []);
            setSnapshots(snapRes.data || []);
        } catch (err) {
            console.error('Failed to load workflow data:', err);
            toast.error(err.response?.data?.message || 'Failed to load workflows from n8n');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAllData();
        toast.info(t('tab_live_workflows') + ' refreshed');
    };

    // Завантаження параметрів авто-розкладу
    const loadScheduleConfig = async () => {
        try {
            const res = await axios.get('/api/workflow-snapshots/schedule/config');
            if (res.data) {
                setScheduleConfig(prev => ({ ...prev, ...res.data }));
            }
        } catch (e) {
            console.warn('Failed to load schedule config:', e);
        }
    };

    // Збереження розкладу авто-снапшотів
    const handleSaveSchedule = async () => {
        setScheduleConfig(prev => ({ ...prev, saving: true }));
        try {
            await axios.post('/api/workflow-snapshots/schedule/config', {
                enabled: scheduleConfig.enabled,
                schedule: scheduleConfig.schedule,
                scope: scheduleConfig.scope,
                retention: scheduleConfig.retention
            });
            toast.success(t('schedule_saved'));
            setScheduleDrawerOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save schedule');
        } finally {
            setScheduleConfig(prev => ({ ...prev, saving: false }));
        }
    };

    // Відкриття діалогу створення снапшоту
    const handleOpenCreateModal = (workflow) => {
        setCreateModal({ open: true, workflow, note: '', loading: false });
    };

    // Виконання створення снапшоту
    const handleConfirmCreate = async () => {
        if (!createModal.workflow) return;
        setCreateModal(prev => ({ ...prev, loading: true }));
        try {
            const res = await axios.post('/api/workflow-snapshots/create', {
                workflowId: createModal.workflow.id,
                note: createModal.note
            });
            toast.success(t('snapshot_created_success'));
            setCreateModal({ open: false, workflow: null, note: '', loading: false });
            // Оновлюємо дані
            await loadAllData();
            // Перемикаємо на вкладку снапшотів, щоб користувач одразу побачив результат
            setActiveTab('snapshots');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create snapshot');
            setCreateModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Відкат (Rollback / Restore) воркфлоу зі снапшоту
    const handleConfirmRollback = async () => {
        if (!rollbackModal.snapshot) return;
        setRollbackModal(prev => ({ ...prev, loading: true }));
        try {
            await axios.post(`/api/workflow-snapshots/${rollbackModal.snapshot.id}/restore`);
            toast.success(t('rollback_success'));
            setRollbackModal({ open: false, snapshot: null, loading: false });
            await loadAllData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rollback failed');
            setRollbackModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Завантаження архіву снапшоту
    const handleDownload = (snapshot) => {
        const link = document.createElement('a');
        link.href = `/api/workflow-snapshots/${snapshot.id}/download`;
        link.setAttribute('download', snapshot.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Перемикання захисту від видалення
    const handleToggleProtect = async (snapshot) => {
        try {
            const res = await axios.put(`/api/workflow-snapshots/${snapshot.id}/protect`);
            const isProt = res.data.snapshot.isProtected;
            toast.info(isProt ? t('protection_enabled') : t('protection_disabled'));
            setSnapshots(prev => prev.map(s => s.id === snapshot.id ? { ...s, isProtected: isProt } : s));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to toggle protection');
        }
    };

    // Видалення снапшоту
    const handleConfirmDelete = async () => {
        if (!deleteModal.snapshot) return;
        setDeleteModal(prev => ({ ...prev, loading: true }));
        try {
            await axios.delete(`/api/workflow-snapshots/${deleteModal.snapshot.id}`);
            toast.success(t('snapshot_deleted'));
            setSnapshots(prev => prev.filter(s => s.id !== deleteModal.snapshot.id));
            setDeleteModal({ open: false, snapshot: null, loading: false });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete snapshot');
            setDeleteModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Фільтрація живих воркфлоу
    const filteredWorkflows = useMemo(() => {
        return liveWorkflows.filter(wf => {
            const matchesSearch = !wfSearch.trim() ||
                wf.name.toLowerCase().includes(wfSearch.toLowerCase()) ||
                String(wf.id).toLowerCase().includes(wfSearch.toLowerCase());

            const matchesStatus = wfStatusFilter === 'all' ||
                (wfStatusFilter === 'active' && wf.active) ||
                (wfStatusFilter === 'inactive' && !wf.active);

            return matchesSearch && matchesStatus;
        });
    }, [liveWorkflows, wfSearch, wfStatusFilter]);

    // Фільтрація збережених снапшотів
    const filteredSnapshots = useMemo(() => {
        return snapshots.filter(snap => {
            const matchesSearch = !snapSearch.trim() ||
                snap.workflowName.toLowerCase().includes(snapSearch.toLowerCase()) ||
                snap.filename.toLowerCase().includes(snapSearch.toLowerCase()) ||
                (snap.note && snap.note.toLowerCase().includes(snapSearch.toLowerCase()));

            const matchesWf = snapWfFilter === 'all' || snap.workflowId === snapWfFilter;

            return matchesSearch && matchesWf;
        });
    }, [snapshots, snapSearch, snapWfFilter]);

    // Лічильники для KPI карток
    const activeWfCount = liveWorkflows.filter(w => w.active).length;

    return (
        <div className="container" style={{ paddingBottom: '3rem' }}>
            {/* Верхній блок заголовка */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700 }}>
                        <Workflow size={28} style={{ color: 'var(--accent)' }} />
                        {t('workflows_title')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.925rem', maxWidth: '680px' }}>
                        {t('workflows_subtitle')}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setScheduleDrawerOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Clock size={16} />
                        <span>{t('schedule_drawer_title')}</span>
                        {scheduleConfig.enabled && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                        )}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        title="Refresh live workflows"
                    >
                        <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            {/* KPI Статистика */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        {t('live_workflows_count')}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{liveWorkflows.length}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--success)' }}>
                            ({activeWfCount} {t('active_status').toLowerCase()})
                        </span>
                    </div>
                </div>

                <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        {t('total_snapshots_count')}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {snapshots.length}
                    </div>
                </div>

                <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        {t('schedule_drawer_title')}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {scheduleConfig.enabled ? (
                            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <CheckCircle2 size={18} /> {t('interval')}: {scheduleConfig.schedule.replace('interval:', '')}m
                            </span>
                        ) : (
                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <XCircle size={18} /> {t('not_scheduled')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Вкладки перемикання розділів */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setActiveTab('workflows')}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'workflows' ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === 'workflows' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                    }}
                >
                    <Layers size={18} />
                    <span>{t('tab_live_workflows')}</span>
                    <span style={{
                        backgroundColor: activeTab === 'workflows' ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: 'white',
                        borderRadius: '999px',
                        padding: '0.1rem 0.5rem',
                        fontSize: '0.75rem'
                    }}>
                        {liveWorkflows.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('snapshots')}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'snapshots' ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === 'snapshots' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                    }}
                >
                    <HardDrive size={18} />
                    <span>{t('tab_snapshots')}</span>
                    <span style={{
                        backgroundColor: activeTab === 'snapshots' ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: 'white',
                        borderRadius: '999px',
                        padding: '0.1rem 0.5rem',
                        fontSize: '0.75rem'
                    }}>
                        {snapshots.length}
                    </span>
                </button>
            </div>

            {/* ВКЛАДКА 1: ЖИВІ РОБОЧІ ПРОЦЕСИ N8N */}
            {activeTab === 'workflows' && (
                <div>
                    {/* Панель фільтрів */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        <div style={{ position: 'relative', flex: '1 1 260px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={wfSearch}
                                onChange={e => setWfSearch(e.target.value)}
                                placeholder={t('search_workflows')}
                                style={{ width: '100%', paddingLeft: '2.5rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <select
                            value={wfStatusFilter}
                            onChange={e => setWfStatusFilter(e.target.value)}
                            style={{ minWidth: '150px' }}
                        >
                            <option value="all">{t('filter_all_workflows')}</option>
                            <option value="active">{t('active_status')}</option>
                            <option value="inactive">{t('inactive_status')}</option>
                        </select>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <RefreshCw size={24} className="spinning" style={{ marginBottom: '0.5rem' }} />
                            <p>Loading workflows from n8n...</p>
                        </div>
                    ) : filteredWorkflows.length === 0 ? (
                        <EmptyState
                            icon={<Workflow size={48} />}
                            title={t('no_live_workflows')}
                            description="Make sure n8n is running and workflows exist in the connected database."
                        />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                            {filteredWorkflows.map(wf => (
                                <div
                                    key={wf.id}
                                    className="card"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        position: 'relative',
                                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                                    }}
                                >
                                    <div>
                                        {/* Заголовок картки */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                                <span
                                                    style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: wf.active ? 'var(--success)' : 'var(--text-secondary)',
                                                        flexShrink: 0
                                                    }}
                                                    title={wf.active ? t('active_status') : t('inactive_status')}
                                                />
                                                <h3
                                                    style={{
                                                        margin: 0,
                                                        fontSize: '1.05rem',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    title={wf.name}
                                                >
                                                    {wf.name}
                                                </h3>
                                            </div>

                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: wf.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                color: wf.active ? 'var(--success)' : 'var(--text-secondary)',
                                                fontWeight: 600
                                            }}>
                                                {wf.active ? t('active_status') : t('inactive_status')}
                                            </span>
                                        </div>

                                        {/* ID воркфлоу */}
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: '0.75rem' }}>
                                            ID: {wf.id}
                                        </div>

                                        {/* Метрики */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <Layers size={15} />
                                                <strong>{wf.nodesCount}</strong> {t('nodes_count')}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <HardDrive size={15} />
                                                <strong>{wf.snapshotsCount}</strong> {t('snapshots_for_wf')}
                                            </span>
                                        </div>

                                        {/* Бейджі креденшелів */}
                                        {wf.credentialTypes && wf.credentialTypes.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                                                {wf.credentialTypes.map((cType, idx) => (
                                                    <span
                                                        key={idx}
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            backgroundColor: 'var(--bg-primary)',
                                                            border: '1px solid var(--border)',
                                                            color: 'var(--text-secondary)',
                                                            borderRadius: '4px',
                                                            padding: '0.1rem 0.4rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        <Key size={11} style={{ color: 'var(--accent)' }} />
                                                        {cType}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Нижня дія картки */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleOpenCreateModal(wf)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
                                        >
                                            <Plus size={16} />
                                            {t('create_snapshot_btn')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ВКЛАДКА 2: ЗБЕРЕЖЕНІ СНАПШОТИ */}
            {activeTab === 'snapshots' && (
                <div>
                    {/* Панель фільтрів */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        <div style={{ position: 'relative', flex: '1 1 260px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={snapSearch}
                                onChange={e => setSnapSearch(e.target.value)}
                                placeholder={t('search_snapshots')}
                                style={{ width: '100%', paddingLeft: '2.5rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <select
                            value={snapWfFilter}
                            onChange={e => setSnapWfFilter(e.target.value)}
                            style={{ minWidth: '180px' }}
                        >
                            <option value="all">{t('filter_all_workflows')}</option>
                            {liveWorkflows.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    {filteredSnapshots.length === 0 ? (
                        <EmptyState
                            icon={<HardDrive size={48} />}
                            title={t('no_snapshots_yet')}
                            description="Take snapshots of individual workflows from the 'n8n Workflows' tab."
                        />
                    ) : (
                        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '0.85rem 1rem' }}>Workflow</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>Size</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>Credentials</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>Storage</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSnapshots.map(snap => {
                                        let creds = [];
                                        try {
                                            creds = typeof snap.credentialsSummary === 'string'
                                                ? JSON.parse(snap.credentialsSummary)
                                                : (snap.credentialsSummary || []);
                                        } catch (_) {
                                            creds = [];
                                        }

                                        return (
                                            <tr key={snap.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                {/* Воркфлоу */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {snap.workflowName}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                        {snap.filename}
                                                    </div>
                                                    {snap.note && (
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                                                            "{snap.note}"
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Тип */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: 'var(--radius)',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        backgroundColor: snap.type === 'auto' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                        color: snap.type === 'auto' ? '#a855f7' : '#3b82f6'
                                                    }}>
                                                        {snap.type === 'auto' ? t('auto_badge') : t('manual_badge')}
                                                    </span>
                                                </td>

                                                {/* Розмір */}
                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                    {snap.size ? `${(snap.size / 1024).toFixed(1)} KB` : '-'}
                                                </td>

                                                {/* Облікові дані */}
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxWidth: '240px' }}>
                                                        {creds.length > 0 ? (
                                                            creds.map((c, i) => (
                                                                <span
                                                                    key={i}
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        backgroundColor: 'var(--bg-primary)',
                                                                        border: '1px solid var(--border)',
                                                                        borderRadius: '4px',
                                                                        padding: '0.1rem 0.35rem',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem'
                                                                    }}
                                                                    title={`${c.name} (${c.type})`}
                                                                >
                                                                    <Key size={10} style={{ color: 'var(--accent)' }} />
                                                                    {c.name || c.type}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>None</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Локація збереження */}
                                                <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                        {snap.storageLocation?.includes('gdrive') && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <Cloud size={16} title="Google Drive" color="#4285F4" />
                                                                <span>GDRIVE</span>
                                                            </span>
                                                        )}
                                                        {snap.storageLocation?.includes('onedrive') && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <Cloud size={16} title="OneDrive" color="#0078D4" />
                                                                <span>ONEDRIVE</span>
                                                            </span>
                                                        )}
                                                        {snap.storageLocation?.includes('s3') && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <Cloud size={16} title="S3" color="var(--warning)" />
                                                                <span>S3</span>
                                                            </span>
                                                        )}
                                                        {(!snap.storageLocation || snap.storageLocation === 'local') && (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <HardDrive size={16} title="Local" color="var(--text-secondary)" />
                                                                <span>Local</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Дата */}
                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                                    {new Date(snap.createdAt).toLocaleString()}
                                                </td>

                                                {/* Дії */}
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                                        {/* Захист від видалення */}
                                                        <button
                                                            onClick={() => handleToggleProtect(snap)}
                                                            className="btn btn-secondary"
                                                            style={{
                                                                padding: '0.4rem',
                                                                color: snap.isProtected ? 'var(--success)' : 'var(--text-secondary)',
                                                                backgroundColor: snap.isProtected ? 'rgba(16, 185, 129, 0.15)' : undefined
                                                            }}
                                                            title={snap.isProtected ? t('protection_enabled') : 'Lock protection'}
                                                        >
                                                            <Shield size={16} fill={snap.isProtected ? 'currentColor' : 'none'} />
                                                        </button>

                                                        {/* Завантаження */}
                                                        <button
                                                            onClick={() => handleDownload(snap)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.4rem' }}
                                                            title={t('download_snapshot')}
                                                        >
                                                            <Download size={16} />
                                                        </button>

                                                        {/* Відкат / Відновлення */}
                                                        <button
                                                            onClick={() => setRollbackModal({ open: true, snapshot: snap, loading: false })}
                                                            className="btn btn-primary"
                                                            style={{ padding: '0.4rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
                                                            title={t('rollback_btn')}
                                                        >
                                                            <RotateCcw size={14} />
                                                            <span>{t('rollback_btn')}</span>
                                                        </button>

                                                        {/* Видалення */}
                                                        <button
                                                            onClick={() => setDeleteModal({ open: true, snapshot: snap, loading: false })}
                                                            disabled={snap.isProtected}
                                                            className="btn btn-danger"
                                                            style={{ padding: '0.4rem', opacity: snap.isProtected ? 0.4 : 1 }}
                                                            title={t('delete')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ДІАЛОГ СТВОРЕННЯ СНАПШОТУ */}
            {createModal.open && createModal.workflow && (
                <div className="modal-overlay" onClick={() => setCreateModal(prev => ({ ...prev, open: false }))}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Workflow size={20} style={{ color: 'var(--accent)' }} />
                            {t('create_snapshot_btn')}
                        </h3>
                        <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Create a standalone snapshot of <strong>{createModal.workflow.name}</strong> along with all associated credentials.
                        </p>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                Note / Label (Optional)
                            </label>
                            <input
                                type="text"
                                value={createModal.note}
                                onChange={e => setCreateModal(prev => ({ ...prev, note: e.target.value }))}
                                placeholder={t('note_placeholder')}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCreateModal(prev => ({ ...prev, open: false }))}
                                disabled={createModal.loading}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirmCreate}
                                disabled={createModal.loading}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                {createModal.loading && <RefreshCw size={14} className="spinning" />}
                                <span>{createModal.loading ? t('creating_snapshot') : t('create_snapshot_btn')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛЬНЕ ВІКНО ПІДТВЕРДЖЕННЯ ROLLBACK / RESTORE */}
            <ConfirmModal
                isOpen={rollbackModal.open}
                danger={false}
                confirmText={rollbackModal.loading ? t('rolling_back') : t('rollback_btn')}
                message={
                    rollbackModal.snapshot
                        ? `${t('rollback_confirm_desc')} [Workflow: ${rollbackModal.snapshot.workflowName}]`
                        : ''
                }
                onConfirm={handleConfirmRollback}
                onCancel={() => setRollbackModal({ open: false, snapshot: null, loading: false })}
            />

            {/* МОДАЛЬНЕ ВІКНО ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ */}
            <ConfirmModal
                isOpen={deleteModal.open}
                danger={true}
                confirmText={t('delete')}
                message={t('delete_snapshot_confirm')}
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteModal({ open: false, snapshot: null, loading: false })}
            />

            {/* ВИЇЗНА ПАНЕЛЬ НАЛАШТУВАННЯ АВТО-РОЗКЛАДУ СНАПШОТІВ */}
            <Sheet
                isOpen={scheduleDrawerOpen}
                onClose={() => setScheduleDrawerOpen(false)}
                title={t('schedule_drawer_title')}
                description="Configure automated periodic snapshots for active workflows"
                icon={<Clock size={22} />}
                footer={
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setScheduleDrawerOpen(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveSchedule}
                            disabled={scheduleConfig.saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            {scheduleConfig.saving && <RefreshCw size={14} className="spinning" />}
                            <span>{t('save_schedule')}</span>
                        </button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Перемикач Enable */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('enable_auto_snapshots')}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Periodically capture workflow state without manual intervention
                            </div>
                        </div>
                        <Switch
                            id="auto-snapshot-toggle"
                            checked={scheduleConfig.enabled}
                            onChange={e => setScheduleConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        />
                    </div>

                    {/* Інтервал */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                            {t('snapshot_interval')}
                        </label>
                        <select
                            value={scheduleConfig.schedule}
                            onChange={e => setScheduleConfig(prev => ({ ...prev, schedule: e.target.value }))}
                            style={{ width: '100%' }}
                        >
                            <option value="interval:60">Every 1 hour</option>
                            <option value="interval:120">Every 2 hours</option>
                            <option value="interval:360">Every 6 hours (Recommended)</option>
                            <option value="interval:720">Every 12 hours</option>
                            <option value="interval:1440">Daily (Every 24 hours)</option>
                        </select>
                    </div>

                    {/* Охоплення (Scope) */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                            {t('snapshot_scope')}
                        </label>
                        <select
                            value={scheduleConfig.scope}
                            onChange={e => setScheduleConfig(prev => ({ ...prev, scope: e.target.value }))}
                            style={{ width: '100%' }}
                        >
                            <option value="all_active">{t('scope_all_active')}</option>
                        </select>
                    </div>

                    {/* Ліміт ротації */}
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.4rem' }}>
                            {t('retention_snapshots')}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={scheduleConfig.retention}
                            onChange={e => setScheduleConfig(prev => ({ ...prev, retention: parseInt(e.target.value, 10) || 5 }))}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.3rem' }}>
                            Automatically deletes older snapshots when limit is reached (protected snapshots are never removed).
                        </span>
                    </div>
                </div>
            </Sheet>
        </div>
    );
}
