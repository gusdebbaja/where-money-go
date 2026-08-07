interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
  /** 0-100 — omit for indeterminate */
  progress?: number;
  /** Covers the whole viewport vs just its container */
  fullScreen?: boolean;
}

// Heights + animation delays create a natural sine-wave feel
const BARS = [
  { h: 0.35, delay: 0 },
  { h: 0.60, delay: 0.12 },
  { h: 0.90, delay: 0.24 },
  { h: 1.00, delay: 0.36 },
  { h: 0.80, delay: 0.24 },
  { h: 0.55, delay: 0.12 },
  { h: 0.30, delay: 0 },
];

const MAX_H = 40; // px

export function LoadingOverlay({
  message = 'Loading…',
  subMessage,
  progress,
  fullScreen = false,
}: LoadingOverlayProps) {
  const wrapper = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center gap-5'
    : 'absolute inset-0 z-20 flex flex-col items-center justify-center gap-5';

  return (
    <div
      className={wrapper}
      style={{
        backgroundColor: fullScreen ? 'var(--bg-primary)' : 'color-mix(in srgb, var(--bg-primary) 90%, transparent)',
        backdropFilter: fullScreen ? undefined : 'blur(2px)',
        animation: 'fade-in 0.18s ease-out both',
      }}
    >
      {/* Finance bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: MAX_H }}>
        {BARS.map(({ h, delay }, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: h * MAX_H,
              backgroundColor: '#3b82f6',
              transformOrigin: 'bottom',
              animation: `bar-wave 1.4s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Text */}
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {message}
        </p>
        {subMessage && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {subMessage}
          </p>
        )}
      </div>

      {/* Progress bar — only shown when progress is defined */}
      {progress !== undefined && (
        <div style={{ width: 220 }}>
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            <span>{Math.round(progress)}%</span>
            <span>{progress < 100 ? 'working…' : 'done'}</span>
          </div>
          <div
            className="overflow-hidden"
            style={{
              height: 6,
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 3,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: '#3b82f6',
                borderRadius: 3,
                transition: 'width 0.15s ease-out',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
