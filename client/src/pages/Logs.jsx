import { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Download, RefreshCw, Trash2 } from 'lucide-react';

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Auto-refresh
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('/api/logs');
            setLogs(res.data);
        } catch (error) {
            console.error('Failed to fetch logs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        const logsText = logs.map(log =>
            `${new Date(log.createdAt).toLocaleString()}\t${log.level.toUpperCase()}\t${log.message}`
        ).join('\n');

        navigator.clipboard.writeText(logsText).then(() => {
            alert('Logs copied to clipboard!');
        }).catch(() => {
            alert('Failed to copy logs');
        });
    };

    const handleDownload = () => {
        const logsText = logs.map(log =>
            `${new Date(log.createdAt).toLocaleString()}\t${log.level.toUpperCase()}\t${log.message}`
        ).join('\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleClear = async () => {
        if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) return;

        try {
            await axios.delete('/api/logs');
            setLogs([]);
            alert('All logs cleared successfully!');
        } catch (error) {
            alert('Failed to clear logs: ' + error.response?.data?.message);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>System Logs</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCopy} className="btn btn-secondary" title="Copy logs to clipboard">
                        <Copy size={16} style={{ marginRight: '0.5rem' }} />
                        Copy
                    </button>
                    <button onClick={handleDownload} className="btn btn-secondary" title="Download logs as text file">
                        <Download size={16} style={{ marginRight: '0.5rem' }} />
                        Download
                    </button>
                    <button onClick={fetchLogs} className="btn btn-secondary" title="Refresh logs">
                        <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
                        Refresh
                    </button>
                    <button onClick={handleClear} className="btn btn-secondary" style={{ color: 'var(--error)' }} title="Clear all logs">
                        <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                        Clear
                    </button>
                </div>
            </div>
            <div className="card" style={{ maxHeight: '600px', overflowY: 'auto', fontFamily: 'monospace' }}>
                {logs.map((log) => (
                    <div key={log.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', minWidth: '180px' }}>
                            {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <span style={{
                            fontWeight: 'bold',
                            color: log.level === 'error' ? 'var(--error)' : log.level === 'warn' ? 'var(--warning)' : 'var(--success)',
                            minWidth: '60px',
                            textTransform: 'uppercase'
                        }}>
                            {log.level}
                        </span>
                        <span>{log.message}</span>
                    </div>
                ))}
                {logs.length === 0 && <div style={{ padding: '1rem', textAlign: 'center' }}>No logs found.</div>}
            </div>
        </div>
    );
}
