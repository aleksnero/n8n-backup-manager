import React, { useRef } from 'react';

/**
 * RippleButton (MagicUI inspired) — кнопка з плавним ефектом розбіжної хвилі при натисканні.
 * 
 * Props:
 *   rippleColor: колір хвилі (за замовчуванням #ADD8E6)
 *   duration: тривалість анімації в мс (600ms)
 *   children, className, onClick, ...props
 */
export function RippleButton({
    children,
    className = '',
    rippleColor = '#ADD8E6',
    duration = 600,
    onClick,
    ...props
}) {
    const buttonRef = useRef(null);

    const handleClick = (e) => {
        const button = buttonRef.current;
        if (button) {
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            const ripple = document.createElement('span');
            ripple.className = 'ripple-circle';
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            ripple.style.backgroundColor = rippleColor.startsWith('#')
                ? `${rippleColor}77` // додаємо напівпрозорість
                : rippleColor;

            button.appendChild(ripple);
            setTimeout(() => {
                ripple.remove();
            }, duration);
        }

        if (onClick) {
            onClick(e);
        }
    };

    return (
        <button
            ref={buttonRef}
            className={`btn ${className}`}
            onClick={handleClick}
            style={{ position: 'relative', overflow: 'hidden' }}
            {...props}
        >
            {children}
        </button>
    );
}

export default RippleButton;
