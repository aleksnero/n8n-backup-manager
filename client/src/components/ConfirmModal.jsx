import { useEffect } from 'react';

/**
 * Кастомний діалог підтвердження замість window.confirm().
 * Використання:
 *   <ConfirmModal
 *     isOpen={isOpen}
 *     message="Ви впевнені?"
 *     onConfirm={handleConfirm}
 *     onCancel={() => setIsOpen(false)}
 *   />
 */
export default function ConfirmModal({ isOpen, message, onConfirm, onCancel, confirmText = 'Підтвердити', cancelText = 'Скасувати', danger = false }) {
    // Закриття клавішею Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={onCancel}
                        autoFocus
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
