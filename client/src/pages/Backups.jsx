import { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, RotateCcw, Trash2, Shield, HardDrive, Cloud } from 'lucide-react';

export default function Backups() {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleRestore = async (id) => {
        if (!window.confirm('Are you sure you want to restore this backup? Current data will be overwritten.')) return;
        try {
            await axios.post(`/api/backups/${id}/restore`);
            alert('Restore started successfully!');
        } catch (error) {
            alert('Restore failed: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this backup?')) return;
        try {
            await axios.delete(`/api/backups/${id}`);
            fetchBackups();
        } catch (error) {
            alert('Delete failed: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDownload = async (id, filename) => {
        try {
            const response = await axios.get(`/api/backups/${id}/download`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Download failed');
        }
    };

    const handleToggleProtection = async (id, currentStatus) => {
        try {
            await axios.patch(`/api/backups/${id}/protect`, {
                isProtected: !currentStatus
            });
            fetchBackups();
        } catch (error) {
            alert('Failed to toggle protection: ' + error.response?.data?.message);
        }
    };

    const renderStorageIcons = (location) => {
        if (!location) location = 'local';
        const locations = location.split(',');
        return (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {locations.includes('local') && <HardDrive size={16} title="Local" color="var(--text-secondary)" />}
                {locations.includes('gdrive') && <Cloud size={16} title="Google Drive" color="#4285F4" />}
                {locations.includes('onedrive') && <Cloud size={16} title="OneDrive" color="#0078D4" />}
                {locations.includes('s3') && <Cloud size={16} title="S3" color="var(--warning)" />}
            </div>
        );
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <h1 style={{ marginBottom: '2rem' }}>Backups</h1>
            <div className="card" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Filename</th>
                            <th>Date</th>
                            <th>Size</th>
                            <th>Type</th>
                            <th>Storage</th>
                            <th>Protected</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {backups.map((backup) => (
                            <tr key={backup.id}>
                                <td>{backup.filename}</td>
                                <td>{new Date(backup.createdAt).toLocaleString()}</td>
                                <td>{(backup.size / 1024 / 1024).toFixed(2)} MB</td>
                                <td>
                                    <span style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: 'var(--radius)',
                                        backgroundColor: backup.type === 'auto' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 75, 113, 0.1)',
                                        color: backup.type === 'auto' ? 'var(--success)' : 'var(--accent)',
                                        fontSize: '0.875rem'
                                    }}>
                                        {backup.type}
                                    </span>
                                </td>
                                <td>{renderStorageIcons(backup.storageLocation)}</td>
                                <td>
                                    <button
                                        onClick={() => handleToggleProtection(backup.id, backup.isProtected)}
                                        className="btn btn-secondary"
                                        title={backup.isProtected ? 'Protected from auto-deletion' : 'Not protected'}
                                        style={{
                                            color: backup.isProtected ? 'var(--success)' : 'var(--text-secondary)',
                                            padding: '0.5rem'
                                        }}
                                    >
                                        <Shield size={16} fill={backup.isProtected ? 'currentColor' : 'none'} />
                                    </button>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => handleDownload(backup.id, backup.filename)} className="btn btn-secondary" title="Download">
                                            <Download size={16} />
                                        </button>
                                        <button onClick={() => handleRestore(backup.id)} className="btn btn-secondary" title="Restore">
                                            <RotateCcw size={16} />
                                        </button>
                                        <button
                                            onClick={() => !backup.isProtected && handleDelete(backup.id)}
                                            className="btn btn-secondary"
                                            style={{
                                                color: backup.isProtected ? 'var(--text-secondary)' : 'var(--error)',
                                                opacity: backup.isProtected ? 0.5 : 1,
                                                cursor: backup.isProtected ? 'not-allowed' : 'pointer'
                                            }}
                                            title={backup.isProtected ? "Unprotect to delete" : "Delete"}
                                            disabled={backup.isProtected}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {backups.length === 0 && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No backups found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
