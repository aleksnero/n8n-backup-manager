/**
 * Lightweight SVG sparkline компонент — без зовнішніх залежностей.
 * Props:
 *   data    — масив чисел (наприклад, розміри бекапів у байтах)
 *   width   — ширина SVG у пікселях (default: 120)
 *   height  — висота SVG у пікселях (default: 40)
 *   color   — колір лінії (default: 'var(--accent)')
 *   fill    — заливка під лінією (default: true)
 */
export default function Sparkline({ data = [], width = 120, height = 40, color = 'var(--accent)', fill = true }) {
    // Потребуємо мінімум 2 точки для побудови лінії
    if (!data || data.length < 2) {
        return <svg width={width} height={height} aria-hidden="true" />;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // уникаємо ділення на 0

    const padding = 4;
    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    // Конвертуємо значення у координати SVG
    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * usableWidth;
        const y = padding + (1 - (val - min) / range) * usableHeight;
        return [x, y];
    });

    const polylinePoints = points.map(([x, y]) => `${x},${y}`).join(' ');

    // Шлях заливки — від першої точки, по лінії, до останньої точки вниз і назад
    const areaPath = [
        `M ${points[0][0]},${height - padding}`,
        ...points.map(([x, y]) => `L ${x},${y}`),
        `L ${points[points.length - 1][0]},${height - padding}`,
        'Z'
    ].join(' ');

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            style={{ display: 'block', overflow: 'visible' }}
        >
            {fill && (
                <path
                    d={areaPath}
                    fill={color}
                    opacity={0.15}
                />
            )}
            <polyline
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Остання точка — виділена */}
            <circle
                cx={points[points.length - 1][0]}
                cy={points[points.length - 1][1]}
                r="3"
                fill={color}
            />
        </svg>
    );
}
