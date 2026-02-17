import React from 'react';

export function BarChart({ labels, values, width = 300, height = 120 }: { labels: string[]; values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const barHeight = height / values.length;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {values.map((v, i) => {
        const w = (v / max) * (width - 80);
        return (
          <g key={i} transform={`translate(0, ${i * barHeight})`}>
            <text x={0} y={barHeight / 2 + 5} fontSize={12} fill="#374151">{labels[i]}</text>
            <rect x={80} y={4} width={w} height={barHeight - 8} rx={4} fill="#3b82f6" />
            <text x={80 + w + 8} y={barHeight / 2 + 5} fontSize={12} fill="#111827">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, width = 400, height = 120 }: { points: number[]; width?: number; height?: number }) {
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? (width - 40) / (points.length - 1) : 0;
  const coords = points.map((p, i) => `${20 + i * step},${height - 20 - (p / max) * (height - 40)}`).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={coords} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const x = 20 + i * step;
        const y = height - 20 - (p / max) * (height - 40);
        return <circle key={i} cx={x} cy={y} r={3} fill="#10b981" />;
      })}
    </svg>
  );
}

export default { BarChart, LineChart };
