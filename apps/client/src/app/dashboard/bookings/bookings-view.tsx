"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sahei/ui";
import { APPOINTMENT_STATUSES } from "@sahei/types";
import type { Appointment, AppointmentStatus } from "@sahei/types";

import { apiClient, ApiError } from "@/lib/api-client";
import { EmptyState } from "@/components/empty-state";
import { AppointmentStatusBadge, STATUS_LABELS } from "@/components/appointment-status-badge";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { value: AppointmentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  ...APPOINTMENT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

function buildQuery(params: { status: string; q: string; skip: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  query.set("skip", String(params.skip));
  query.set("take", String(PAGE_SIZE));
  return query.toString();
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return "Today";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatScheduledAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function groupByDay(appointments: Appointment[]) {
  const sections: { label: string; items: Appointment[] }[] = [];

  for (const appointment of appointments) {
    const key = dayKey(appointment.scheduledAt);
    const last = sections[sections.length - 1];
    if (last && dayKey(last.items[0].scheduledAt) === key) {
      last.items.push(appointment);
    } else {
      sections.push({ label: formatDayLabel(appointment.scheduledAt), items: [appointment] });
    }
  }

  return sections;
}

export function BookingsView() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const retry = useCallback(() => {
    setAppointments(null);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppointments(null);
      setError(null);
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<Appointment[]>(`/appointments?${buildQuery({ status, q: debouncedSearch, skip: 0 })}`)
      .then((data) => {
        if (cancelled) return;
        setAppointments(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load appointments. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [status, debouncedSearch, reloadToken]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    apiClient
      .get<Appointment[]>(`/appointments?${buildQuery({ status, q: debouncedSearch, skip: appointments?.length ?? 0 })}`)
      .then((data) => {
        setAppointments((prev) => [...(prev ?? []), ...data]);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load more appointments. Please try again.");
      })
      .finally(() => setLoadingMore(false));
  }, [appointments, status, debouncedSearch]);

  const isFiltered = status !== "" || debouncedSearch !== "";
  const sections = appointments ? groupByDay(appointments) : [];
  const showSectionLabels = sections.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search name, phone, or reference"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
          aria-label="Search appointments"
        />
        <select
          value={status}
          onChange={(event) => {
            setAppointments(null);
            setError(null);
            setStatus(event.target.value as AppointmentStatus | "");
          }}
          aria-label="Filter by status"
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {!error && !appointments && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!error && appointments && appointments.length === 0 && (
        <EmptyState
          description={
            isFiltered
              ? "No appointments match these filters."
              : "Appointments booked by your AI phone agent will show up here."
          }
        />
      )}

      {!error && appointments && appointments.length > 0 && (
        <>
          <Card className="hidden sm:block">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booking reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.map((section) => (
                    <Fragment key={section.label}>
                      {showSectionLabels && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={5}
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {section.label}
                          </TableCell>
                        </TableRow>
                      )}
                      {section.items.map((appointment) => (
                        <TableRow
                          key={appointment.id}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() => setSelected(appointment)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelected(appointment);
                            }
                          }}
                        >
                          <TableCell className="whitespace-nowrap text-foreground">
                            {formatTime(appointment.scheduledAt)}
                          </TableCell>
                          <TableCell className="text-foreground">{appointment.customerName}</TableCell>
                          <TableCell className="text-foreground">{appointment.service.name}</TableCell>
                          <TableCell>
                            <AppointmentStatusBadge status={appointment.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{appointment.bookingReference}</TableCell>
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                )}
                {section.items.map((appointment) => (
                  <Card
                    key={appointment.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => setSelected(appointment)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(appointment);
                      }
                    }}
                  >
                    <CardContent className="flex flex-col gap-2 pt-6">
                      <div className="flex items-center justify-between gap-2">
                        <AppointmentStatusBadge status={appointment.status} />
                        <span className="text-xs text-muted-foreground">{formatTime(appointment.scheduledAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{appointment.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.service.name} · {appointment.customerPhone}
                      </p>
                      <p className="text-xs text-muted-foreground">Ref: {appointment.bookingReference}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.customerName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {formatScheduledAt(selected.scheduledAt)}
                  <AppointmentStatusBadge status={selected.status} />
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="text-foreground">{selected.customerPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="text-foreground">{selected.service.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Booking reference</span>
                  <span className="text-foreground">{selected.bookingReference}</span>
                </div>
                {selected.notes && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="text-foreground">{selected.notes}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
