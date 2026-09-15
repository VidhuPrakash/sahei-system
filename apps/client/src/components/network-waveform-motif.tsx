export function NetworkWaveformMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 320"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <line x1="200" y1="120" x2="262" y2="76" className="stroke-shell-border" strokeWidth="1.5" />
      <line x1="262" y1="76" x2="324" y2="96" className="stroke-shell-border" strokeWidth="1.5" />
      <line x1="262" y1="76" x2="300" y2="34" className="stroke-shell-border" strokeWidth="1.5" />
      <line x1="200" y1="120" x2="146" y2="68" className="stroke-shell-border" strokeWidth="1.5" />
      <line x1="146" y1="68" x2="100" y2="96" className="stroke-shell-border" strokeWidth="1.5" />

      <circle cx="262" cy="76" r="5" className="stroke-primary" strokeWidth="2" />
      <circle cx="324" cy="96" r="4" className="stroke-primary" strokeWidth="2" />
      <circle cx="300" cy="34" r="3" className="fill-primary" />
      <circle cx="146" cy="68" r="5" className="stroke-primary" strokeWidth="2" />
      <circle cx="100" cy="96" r="3" className="fill-primary" />

      <g className="[transform-origin:center]">
        <rect x="152" y="180" width="9" height="80" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "0ms" }} />
        <rect x="171" y="150" width="9" height="140" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "120ms" }} />
        <rect x="190" y="110" width="9" height="220" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "240ms" }} />
        <rect x="209" y="70" width="9" height="300" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "360ms" }} />
        <rect x="228" y="110" width="9" height="220" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "480ms" }} />
        <rect x="247" y="150" width="9" height="140" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "600ms" }} />
        <rect x="266" y="180" width="9" height="80" rx="4.5" className="fill-primary waveform-bar" style={{ animationDelay: "720ms" }} />
      </g>
    </svg>
  );
}
