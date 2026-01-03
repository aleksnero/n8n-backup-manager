import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSetup, setIsSetup] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const [setupAllowed, setSetupAllowed] = useState(false);

    useEffect(() => {
        const checkSetupStatus = async () => {
            try {
                const res = await axios.get('/api/auth/setup-status');
                // If isSetup is false, then setup IS allowed.
                // If isSetup is true, then setup is NOT allowed.
                setSetupAllowed(!res.data.isSetup);
            } catch (error) {
                console.error('Failed to check setup status', error);
            }
        };
        checkSetupStatus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isSetup) {
            try {
                await axios.post('/api/auth/setup', { username, password });
                alert(t('setup_success'));
                setIsSetup(false);
                setSetupAllowed(false); // Setup no longer allowed
            } catch (error) {
                setError(error.response?.data?.message || t('setup_failed'));
            }
        } else {
            const success = await login(username, password);
            if (success) {
                navigate('/');
            } else {
                setError(t('login_failed'));
            }
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="card" style={{ width: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{isSetup ? t('setup_title') : t('login_title')}</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>{t('username')}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '2rem' }}>
                        <label>{t('password')}</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{ paddingRight: '40px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        {isSetup ? t('create_admin') : t('login_btn')}
                    </button>
                    {setupAllowed && (
                        <button
                            type="button"
                            onClick={() => setIsSetup(!isSetup)}
                            className="btn btn-secondary"
                            style={{ width: '100%', marginTop: '0.5rem' }}
                        >
                            {isSetup ? 'Back to Login' : 'First Time Setup'}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
