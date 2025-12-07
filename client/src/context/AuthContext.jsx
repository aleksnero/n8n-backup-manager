import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Setup Axios interceptor for 401s
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        const initAuth = async () => {
            const token = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (token && savedUser) {
                axios.defaults.headers.common['x-access-token'] = token;
                try {
                    // Verify token with backend
                    await axios.get('/api/auth/verify');
                    setUser(JSON.parse(savedUser));
                } catch (error) {
                    // Token invalid or expired
                    console.log('Session expired or invalid');
                    logout();
                }
            }
            setLoading(false);
        };

        initAuth();

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post('/api/auth/login', { username, password });
            const { accessToken, ...userData } = res.data;
            localStorage.setItem('token', accessToken);
            localStorage.setItem('user', JSON.stringify(userData));
            axios.defaults.headers.common['x-access-token'] = accessToken;
            setUser(userData);
            return true;
        } catch (error) {
            console.error('Login failed', error);
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['x-access-token'];
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
