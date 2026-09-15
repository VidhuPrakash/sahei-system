import { NetworkWaveformMotif } from "./network-waveform-motif";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-shell-background p-12 text-shell-foreground md:flex">
        <span className="text-2xl font-semibold tracking-tight">SaHei</span>
        <NetworkWaveformMotif className="absolute inset-x-0 top-1/2 mx-auto h-64 w-full max-w-md -translate-y-1/2 opacity-90" />
        <p className="max-w-xs text-sm text-shell-muted-foreground">
          AI phone agent for Malayalam-speaking businesses — answers calls, books appointments, and
          shows you exactly what happened.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center bg-background p-6 md:p-12">
        <span className="mb-8 text-2xl font-semibold tracking-tight text-foreground md:hidden">
          SaHei
        </span>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
