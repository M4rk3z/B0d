package com.b0d.asistencia;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class AttendanceRepository {
    private final SQLiteDatabase db;
    AttendanceRepository(SQLiteDatabase db) { this.db = db; }
    static final class Context {
        final String scheduleId, zone;
        final LocalDate date;
        final WorkCalculator.Plan plan;
        Context(String scheduleId, String zone, LocalDate date, WorkCalculator.Plan plan) {
            this.scheduleId = scheduleId; this.zone = zone; this.date = date; this.plan = plan;
        }
        String key() { return date + "/" + zone + "/" + scheduleId; }
    }
    static final class Summary {
        final Context context;
        final String code, name;
        final List<WorkCalculator.Event> events = new ArrayList<>();
        WorkCalculator.Result result;
        long lastTime;
        Summary(Context context, String code, String name) { this.context = context; this.code = code; this.name = name; }
    }
    private Context load(String scheduleId, String zone, LocalDate date) {
        WorkCalculator.Plan plan = null;
        if (scheduleId != null) {
            SchedulesRepository.Schedule schedule = new SchedulesRepository(db).get(scheduleId);
            if (schedule != null) for (ScheduleRules.Day day : schedule.days) if (day.weekday == date.getDayOfWeek().getValue()) {
                plan = new WorkCalculator.Plan(schedule.id, schedule.name, schedule.zone, date, day, schedule.markBreaks);
                break;
            }
        }
        return new Context(scheduleId, zone, date, plan);
    }
    private Context onDate(String worker, LocalDate date, String fallbackZone) {
        try (Cursor c = db.rawQuery("SELECT s.id,s.zone_id FROM schedule_assignments a JOIN schedules s ON s.id=a.schedule_id WHERE a.worker_id=? AND a.effective_date<=? ORDER BY a.effective_date DESC LIMIT 1", new String[]{worker, date.toString()})) {
            return c.moveToFirst() ? load(c.getString(0), c.getString(1), date) : load(null, fallbackZone, date);
        }
    }
    Context choose(String worker, long time, String zone) {
        LocalDate date = Instant.ofEpochMilli(time).atZone(ZoneId.of(zone)).toLocalDate();
        Context today = onDate(worker, date, zone);
        LocalDate scheduleDate = Instant.ofEpochMilli(time).atZone(ZoneId.of(today.zone)).toLocalDate();
        if (!date.equals(scheduleDate)) { date = scheduleDate; today = onDate(worker, date, today.zone); }
        Context yesterday = onDate(worker, date.minusDays(1), today.zone);
        if (yesterday.plan != null && yesterday.plan.day.end >= 1440 &&
                time >= yesterday.plan.at(yesterday.plan.day.start) && time < yesterday.plan.at(yesterday.plan.day.end)) return yesterday;
        return today;
    }
    void bind(long seq, Context context) {
        ContentValues values = new ContentValues();
        values.put("entry_seq", seq); values.put("schedule_id", context.scheduleId);
        values.put("work_date", context.date.toString()); values.put("zone_id", context.zone);
        db.insertOrThrow("shift_contexts", null, values);
    }
    void backfill() {
        try (Cursor c = db.rawQuery("SELECT seq,worker_id,occurred_at,zone_id FROM punches WHERE kind='IN' AND seq NOT IN (SELECT entry_seq FROM shift_contexts) ORDER BY seq", null)) {
            while (c.moveToNext()) bind(c.getLong(0), choose(c.getString(1), c.getLong(2), c.getString(3)));
        }
    }
    private Context forEntry(long seq, String worker, long time, String zone) {
        try (Cursor c = db.query("shift_contexts", new String[]{"schedule_id","work_date","zone_id"}, "entry_seq=?", new String[]{Long.toString(seq)}, null, null, null)) {
            if (c.moveToFirst()) return load(c.isNull(0) ? null : c.getString(0), c.getString(2), LocalDate.parse(c.getString(1)));
        }
        return choose(worker, time, zone);
    }
    Context forAction(String worker, String lastKind, long now, String zone) {
        if (lastKind == null || "OUT".equals(lastKind)) return choose(worker, now, zone);
        try (Cursor c = db.rawQuery("SELECT seq,occurred_at,zone_id FROM punches WHERE worker_id=? AND kind='IN' ORDER BY seq DESC LIMIT 1", new String[]{worker})) {
            if (c.moveToFirst()) return forEntry(c.getLong(0), worker, c.getLong(1), c.getString(2));
        }
        return choose(worker, now, zone);
    }
    List<Summary> summaries(String worker, long now) {
        Map<String, Summary> days = new LinkedHashMap<>();
        Context context = null;
        try (Cursor c = db.query("punches", new String[]{"seq","worker_code","worker_name","kind","occurred_at","zone_id"}, "worker_id=?", new String[]{worker}, null, null, "seq")) {
            while (c.moveToNext()) {
                String kind = c.getString(3);
                long time = c.getLong(4);
                if ("IN".equals(kind)) context = forEntry(c.getLong(0), worker, time, c.getString(5));
                if (context == null) context = choose(worker, time, c.getString(5));
                Summary summary = days.get(context.key());
                if (summary == null) { summary = new Summary(context, c.getString(1), c.getString(2)); days.put(context.key(), summary); }
                summary.events.add(new WorkCalculator.Event(kind, time));
                summary.lastTime = time;
            }
        }
        List<Summary> result = new ArrayList<>(days.values());
        for (Summary row : result) row.result = WorkCalculator.calculate(row.context.plan, row.events, now);
        result.sort((a,b) -> Long.compare(b.lastTime,a.lastTime));
        return result;
    }
    Summary latest(String worker, long now) {
        List<Summary> rows = summaries(worker, now);
        return rows.isEmpty() ? null : rows.get(0);
    }
    List<Summary> recentSummaries(long now) {
        List<Summary> result = new ArrayList<>();
        try (Cursor c = db.rawQuery("SELECT DISTINCT worker_id FROM punches", null)) {
            while (c.moveToNext()) result.addAll(summaries(c.getString(0), now));
        }
        result.sort((a,b) -> Long.compare(b.lastTime,a.lastTime));
        return new ArrayList<>(result.subList(0, Math.min(30,result.size())));
    }
}
