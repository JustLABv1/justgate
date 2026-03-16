"use client";

interface RateLimitGaugeProps {
  /** Configured limit in requests per minute */
  rpm: number;
  /** Burst size */
  burst: number;
  /** Label shown below the gauge */
  label?: string;
}

/**
 * SVG arc gauge showing current rate limit consumption.
 * Because we don't have real-time bucket state from the backend,
 * this renders as a static configuration display that shows the limit
 * values clearly, styled as a compact visual gauge.
 */
export function RateLimitGauge({ rpm, burst, label }: RateLimitGaugeProps) {
  if (rpm <= 0) return null;

  const SIZE = 64;
  const STROKE = 5;
  const R = (SIZE - STROKE * 2) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // 270° sweep starting from 225° (bottom-left) going clockwise to bottom-right
  const START_ANGLE = 225;
  const SWEEP = 270;

  function polarToXY(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(startAngle: number, endAngle: number, r: number) {
    const s = polarToXY(startAngle, r);
    const e = polarToXY(endAngle, r);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackPath = arcPath(START_ANGLE, START_ANGLE + SWEEP, R);

  return (
    <div className="flex flex-col items-center gap-1" title={`Rate limit: ${rpm} req/min, burst ${burst}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Accent arc — static, representing the configured limit */}
        <path
          d={arcPath(START_ANGLE, START_ANGLE + SWEEP * 0.72, R)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Center text */}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--foreground)">
          {rpm >= 1000 ? `${(rpm / 1000).toFixed(rpm % 1000 === 0 ? 0 : 1)}k` : String(rpm)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5" fill="var(--muted-foreground)" opacity="0.7">
          /min
        </text>
      </svg>
      {label && (
        <div className="text-center text-[9px] text-muted-foreground/60 leading-tight">{label}</div>
      )}
    </div>
  );
}
