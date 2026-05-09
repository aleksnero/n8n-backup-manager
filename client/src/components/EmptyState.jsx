/**
 * Універсальний компонент порожнього стану.
 * Використовується коли список порожній — замість голого тексту.
 *
 * Props:
 *   icon     — React-елемент іконки (lucide-react)
 *   title    — заголовок
 *   description — підзаголовок (необов'язково)
 *   action   — React-елемент кнопки/посилання (необов'язково)
 */
export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="empty-state">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <p className="empty-state-title">{title}</p>
            {description && <p className="empty-state-desc">{description}</p>}
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
}
