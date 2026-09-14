import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Універсальний компонент виїзної правої панелі (Sheet / Slide-over Drawer)
 * 
 * Props:
 *   isOpen: boolean — чи відкрита панель
 *   onClose: function — обробник закриття
 *   title: string | ReactNode — заголовок панелі
 *   description: string — підзаголовок/опис
 *   icon: ReactNode — іконка для заголовка
 *   children: ReactNode — основний вміст форми
 *   footer: ReactNode — кнопки дій (Зберегти / Закрити)
 */
export default function Sheet({
    isOpen,
    onClose,
    title,
    description,
    icon,
    children,
    footer
}) {
    // Закриття по натисканню клавіші Escape та блокування скролу сторінки
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <div
                className="sheet-drawer"
                onClick={(e) => e.stopPropagation()} // Запобігаємо закриттю при кліку всередині панелі
            >
                {/* Заголовок панелі */}
                <div className="sheet-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        {icon && (
                            <div className="sheet-icon-badge">
                                {icon}
                            </div>
                        )}
                        <div>
                            <h3 className="sheet-title">{title}</h3>
                            {description && <p className="sheet-description">{description}</p>}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sheet-close-btn"
                        onClick={onClose}
                        title="Close (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Основний вміст панелі */}
                <div className="sheet-body">
                    {children}
                </div>

                {/* Нижня панель дій (якщо передана) */}
                {footer && (
                    <div className="sheet-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
