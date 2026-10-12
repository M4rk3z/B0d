package com.b0d.asistencia;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Computes elapsed work; keeps overtime targets in nominal scheduled minutes. */
public final class WorkCalculator {
    public static final class Plan {
        public final String id, name, zone;
        public final LocalDate date;
        public final ScheduleRules.Day day;
        public final boolean marked;
        public Plan(String id, String name, String zone, LocalDate date, ScheduleRules.Day day, boolean marked) {
            this.id = id; this.name = name; this.zone = zone; this.date = date; this.day = day; this.marked = marked;
        }
        public long at(int minute) { return date.atStartOfDay().plusMinutes(minute).atZone(ZoneId.of(zone)).toInstant().toEpochMilli(); }
    }
    public static final class Event {
        public final String kind;
        public final long time;
        public Event(String kind, long time) { this.kind = kind; this.time = time; }
    }
    public static final class Result {
        public long effective, excluded, ordinary, overtime, late;
        public boolean open, resting, invalid, missingBreaks;
        public boolean provisional() { return open || invalid || missingBreaks; }
    }
    private static final class Span {
        final long from, to;
        Span(long from, long to) { this.from = from; this.to = to; }
    }
    public static Result calculate(Plan plan, List<Event> events, long now) {
        Result result = new Result();
        List<Span> presence = new ArrayList<>(), rests = new ArrayList<>();
        long start = 0, restStart = 0, previous = Long.MIN_VALUE, firstEntry = Long.MAX_VALUE;
        int state = 0, completedRests = 0;
        for (Event event : events) {
            if (event.time < previous) { result.invalid = true; continue; }
            previous = event.time;
            switch (event.kind) {
                case "IN":
                    if (state != 0) { result.invalid = true; break; }
                    start = event.time; firstEntry = Math.min(firstEntry, start); state = 1; break;
                case "BREAK_START":
                    if (state != 1) { result.invalid = true; break; }
                    restStart = event.time; state = 2; break;
                case "BREAK_END":
                    if (state != 2) { result.invalid = true; break; }
                    rests.add(new Span(restStart, event.time)); completedRests++; state = 1; break;
                case "OUT":
                    if (state == 0) { result.invalid = true; break; }
                    if (state == 2) { rests.add(new Span(restStart, event.time)); result.invalid = true; }
                    presence.add(new Span(start, event.time)); state = 0; break;
                default: result.invalid = true;
            }
        }
        long through = Math.max(now, previous);
        if (now < previous) result.invalid = true;
        result.open = state != 0;
        result.resting = state == 2;
        if (state != 0) presence.add(new Span(start, through));
        if (state == 2) rests.add(new Span(restStart, through));
        presence = merge(presence);
        long gross = 0;
        for (Span p : presence) gross += p.to - p.from;
        result.effective = Math.max(0, gross);
        result.excluded = 0;
        result.ordinary = Math.min(8 * 3600000L, result.effective);
        result.overtime = Math.max(0, result.effective - 8 * 3600000L);
        result.late = 0;
        return result;
    }
    private static long overlap(Span a, Span b) { return Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from)); }
    private static List<Span> merge(List<Span> spans) {
        List<Span> sorted = new ArrayList<>(spans), result = new ArrayList<>();
        sorted.sort(Comparator.comparingLong(span -> span.from));
        for (Span span : sorted) {
            if (span.to <= span.from) continue;
            if (!result.isEmpty() && span.from <= result.get(result.size() - 1).to) {
                Span old = result.remove(result.size() - 1);
                result.add(new Span(old.from, Math.max(old.to, span.to)));
            } else result.add(span);
        }
        return result;
    }
}
