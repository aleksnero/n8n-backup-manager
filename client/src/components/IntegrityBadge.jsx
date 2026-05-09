import { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, ShieldAlert, ShieldOff, Loader } from 'lucide-react';

/**
 * Бейдж перевірки цілісності бекапу.
 * - Linux-сервер: кнопка-іконка → запускає перевірку → показує ✅ / ❌
 * - Інші платформи: сіра іконка з тултіпом "Linux only"
 *
 * Props:
 *   backupId — ID бекапу для запиту до API
 */
export default function IntegrityBadge({ backupId }) {
    // null = не перевірявся, true = OK, false = пошкоджений, 'unsupported' = не Linux
    const [status, setStatus] = useState(null);
    const [checking, setChecking] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const runCheck = async () => {
        if (checking) return;
        setChecking(true);
        setErrorMsg('');
        try {
            const res = await axios.get(`/api/backups/${backupId}/check`);
            if (!res.data.supported) {
                setStatus('unsupported');
            } else {
                setStatus(res.data.ok ? 'ok' : 'corrupt');
                if (!res.data.ok) setErrorMsg(res.data.error || 'Corrupted');
            }
        } catch {
            setStatus('corrupt');
            setErrorMsg('Check failed');
        } finally {
            setChecking(false);
        }
    };

    // Стани відображення
    if (checking) {
        return (
            <span title="Checking..." style={{ color: 'var(--text-secondary)' }}>
                <Loader size={16} className="spin" />
            </span>
        );
    }

    if (status === 'unsupported') {
        return (
            <span title="Integrity check requires Linux server" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                <ShieldOff size={16} />
            </span>
        );
    }

    if (status === 'ok') {
        return (
            <span title="Integrity OK" style={{ color: 'var(--success)', cursor: 'pointer' }} onClick={runCheck}>
                <ShieldCheck size={16} />
            </span>
        );
    }

    if (status === 'corrupt') {
        return (
            <span title={`Corrupted: ${errorMsg}`} style={{ color: 'var(--error)', cursor: 'pointer' }} onClick={runCheck}>
                <ShieldAlert size={16} />
            </span>
        );
    }

    // Початковий стан — кнопка "Перевірити"
    return (
        <button
            onClick={runCheck}
            className="btn btn-secondary"
            title="Check integrity"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
            <ShieldCheck size={14} />
            <span>Check</span>
        </button>
    );
}
