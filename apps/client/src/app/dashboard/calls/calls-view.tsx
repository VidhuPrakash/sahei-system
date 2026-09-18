"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sahei/ui";
import type { CallTranscript } from "@sahei/types";

import { apiClient, ApiError } from "@/lib/api-client";
import { EmptyState } from "@/components/empty-state";
import { OutcomeBadge } from "@/components/outcome-badge";

const OUTCOME_LEGEND =
  "Booked = a slot was confirmed · Inquiry = question answered, no booking needed · No outcome = call ended without a result";

function formatStartedAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDay(transcripts: CallTranscript[]) {
  const todayKey = new Date().toDateString();
  const today: CallTranscript[] = [];
  const earlier: CallTranscript[] = [];

  for (const transcript of transcripts) {
    const bucket = new Date(transcript.startedAt).toDateString() === todayKey ? today : earlier;
    bucket.push(transcript);
  }

  return [
    { label: "Today", items: today },
    { label: "Earlier", items: earlier },
  ].filter((section) => section.items.length > 0);
}

export function CallsView() {
  const [transcripts, setTranscripts] = useState<CallTranscript[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CallTranscript | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => {
    setTranscripts(null);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<CallTranscript[]>("/call-transcripts")
      .then((data) => {
        if (!cancelled) setTranscripts(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load call transcripts. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!transcripts) {
    return (
      <>
        <Card className="hidden sm:block">
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Booking reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 sm:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="flex flex-col gap-2 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (transcripts.length === 0) {
    return <EmptyState description="Calls your AI phone agent handles will show up here." />;
  }

  const sections = groupByDay(transcripts);
  const showSectionLabels = sections.length > 1;

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">{OUTCOME_LEGEND}</p>

      <Card className="hidden sm:block">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Booking reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <Fragment key={section.label}>
                  {showSectionLabels && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {section.label}
                      </TableCell>
                    </TableRow>
                  )}
                  {section.items.map((transcript) => (
                    <TableRow
                      key={transcript.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => setSelected(transcript)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(transcript);
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap text-foreground">
                        {formatStartedAt(transcript.startedAt)}
                      </TableCell>
                      <TableCell className="text-foreground">{transcript.customerPhone}</TableCell>
                      <TableCell>
                        <OutcomeBadge outcome={transcript.outcome} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{transcript.bookingReference ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:hidden">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-2">
            {showSectionLabels && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</p>
            )}
            {section.items.map((transcript) => (
              <Card
                key={transcript.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => setSelected(transcript)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(transcript);
                  }
                }}
              >
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <OutcomeBadge outcome={transcript.outcome} />
                    <span className="text-xs text-muted-foreground">{formatStartedAt(transcript.startedAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{transcript.customerPhone}</p>
                  {transcript.bookingReference && (
                    <p className="text-xs text-muted-foreground">Ref: {transcript.bookingReference}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.customerPhone}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {formatStartedAt(selected.startedAt)}
                  <OutcomeBadge outcome={selected.outcome} />
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {selected.transcript.map((turn, index) => (
                  <div
                    key={index}
                    className={cn("flex flex-col gap-1", turn.role === "assistant" ? "items-start" : "items-end")}
                  >
                    <span className="text-xs text-muted-foreground">
                      {turn.role === "assistant" ? "Your AI agent" : "Caller"}
                    </span>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm text-foreground",
                        turn.role === "assistant" ? "bg-secondary" : "bg-primary/10"
                      )}
                    >
                      {turn.content}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
