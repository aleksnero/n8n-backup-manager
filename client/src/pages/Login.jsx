import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
                alert('Setup complete! Please login.');
                setIsSetup(false);
                setSetupAllowed(false); // Setup no longer allowed
            } catch (error) {
                setError(error.response?.data?.message || 'Setup failed');
            }
        } else {
            const success = await login(username, password);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid credentials');
            }
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="card" style={{ width: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{isSetup ? 'Initial Setup' : 'n8n Backup Manager'}</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ marginBottom: '2rem' }}>
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</div>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        {isSetup ? 'Create Admin' : 'Login'}
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
