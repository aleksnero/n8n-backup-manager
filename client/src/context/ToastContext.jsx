import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

/**
 * Хук для використання toast-сповіщень у будь-якому компоненті.
 * Методи: toast.success(msg), toast.error(msg), toast.info(msg)
 */
export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx.toast;
};

let toastIdCounter = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    // Додає нове сповіщення та автоматично видаляє через 4 секунди
    const addToast = useCallback((message, type = 'info') => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// Контейнер з анімованими сповіщеннями (знизу праворуч)
function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null;

    return (
        <div className="toast-container" role="alert" aria-live="polite">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    onClick={() => onRemove(toast.id)}
                >
                    <span className="toast-icon">
                        {toast.type === 'success' && '✓'}
                        {toast.type === 'error' && '✕'}
                        {toast.type === 'info' && 'ℹ'}
                    </span>
                    <span className="toast-message">{toast.message}</span>
                </div>
            ))}
        </div>
    );
}
