import Image from "next/image";

import { cn } from "@sahei/ui";

import { NetworkWaveformMotif } from "./network-waveform-motif";

export function AuthShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-shell-background p-12 text-shell-foreground md:flex">
        <Image src="/logo.png" alt="SaHei" width={96} height={96} className="h-7 w-auto" priority />
        <NetworkWaveformMotif className="absolute inset-x-0 top-1/2 mx-auto h-64 w-full max-w-md -translate-y-1/2 opacity-90" />
        <p className="max-w-xs text-sm text-shell-muted-foreground">
          AI phone agent for Malayalam-speaking businesses — answers calls, books appointments, and
          shows you exactly what happened.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center bg-background p-6 md:p-12">
        <Image
          src="/logo.png"
          alt="SaHei"
          width={96}
          height={96}
          className="mb-8 h-8 w-auto md:hidden"
          priority
        />
        <div className={cn("w-full max-w-sm", className)}>{children}</div>
      </div>
    </div>
  );
}
