export const ConfidenceRing = ({ value, size = 56, label }: { value: number; size?: number; label?: string }) => {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? "hsl(var(--verified))" : value >= 60 ? "hsl(var(--warning))" : "hsl(var(--primary))";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" opacity={0.25} />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="mono text-[11px] font-bold leading-none">{value}%</div>
          {label && <div className="mt-0.5 text-[9px] text-muted-foreground">{label}</div>}
        </div>
      </div>
    </div>
  );
};
