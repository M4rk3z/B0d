package com.b0d.asistencia;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class SchedulesRepository {
    private final SQLiteDatabase db;
    SchedulesRepository(SQLiteDatabase db) { this.db = db; }
    private String display(String id, String fallback) {
        if (id.startsWith("web:")) try (Cursor c = db.rawQuery("SELECT display_name FROM cloud_schedule_names WHERE local_id=?",new String[]{id})) { if(c.moveToFirst())return c.getString(0); }
        return fallback;
    }
    static final class Schedule {
        final String id, name, zone;
        final boolean markBreaks;
        final List<ScheduleRules.Day> days;
        Schedule(String id, String name, String zone, boolean markBreaks, List<ScheduleRules.Day> days) {
            this.id = id; this.name = name; this.zone = zone; this.markBreaks = markBreaks; this.days = days;
        }
    }
    List<Schedule> list() {
        List<Schedule> result = new ArrayList<>();
        try (Cursor c = db.query("schedules", new String[]{"id", "name", "zone_id", "mark_breaks"}, null, null, null, null, "name COLLATE NOCASE")) {
            while (c.moveToNext()) result.add(new Schedule(c.getString(0), display(c.getString(0),c.getString(1)), c.getString(2), c.getInt(3) == 1, days(c.getString(0))));
        }
        return result;
    }
    Schedule get(String id) {
        try (Cursor c = db.query("schedules", new String[]{"id","name","zone_id","mark_breaks"}, "id=?", new String[]{id}, null, null, null)) {
            return c.moveToFirst() ? new Schedule(c.getString(0),display(c.getString(0),c.getString(1)),c.getString(2),c.getInt(3)==1,days(id)) : null;
        }
    }
    private List<ScheduleRules.Day> days(String schedule) {
        List<ScheduleRules.Day> result = new ArrayList<>();
        try (Cursor c = db.query("schedule_days", new String[]{"weekday", "start_minute", "end_minute"}, "schedule_id = ?", new String[]{schedule}, null, null, "weekday")) {
            while (c.moveToNext()) {
                StringBuilder intervals = new StringBuilder();
                try (Cursor b = db.query("schedule_breaks", new String[]{"start_offset", "end_offset"}, "schedule_id = ? AND weekday = ?",
                        new String[]{schedule, c.getString(0)}, null, null, "start_offset")) {
                    while (b.moveToNext()) {
                        if (intervals.length() > 0) intervals.append(";");
                        intervals.append(ScheduleRules.clock(c.getInt(1) + b.getInt(0))).append("-")
                                .append(ScheduleRules.clock(c.getInt(1) + b.getInt(1)));
                    }
                }
                result.add(new ScheduleRules.Day(c.getInt(0), ScheduleRules.clock(c.getInt(1)), ScheduleRules.clock(c.getInt(2)), intervals.toString()));
            }
        }
        return result;
    }
    void create(String rawName, boolean markBreaks, List<ScheduleRules.Day> days) {
        String name = rawName.trim();
        if (name.isEmpty() || name.length() > 80) throw new IllegalArgumentException("Nombre de horario requerido (máximo 80 caracteres).");
        ScheduleRules.validateWeek(days);
        String id = UUID.randomUUID().toString();
        db.beginTransaction();
        try {
            ContentValues s = new ContentValues();
            s.put("id", id); s.put("name", name); s.put("mark_breaks", markBreaks ? 1 : 0);
            s.put("zone_id", ZoneId.systemDefault().getId()); s.put("created_at", System.currentTimeMillis());
            db.insertOrThrow("schedules", null, s);
            for (ScheduleRules.Day day : days) {
                ContentValues d = new ContentValues();
                d.put("schedule_id", id); d.put("weekday", day.weekday); d.put("start_minute", day.start); d.put("end_minute", day.end);
                db.insertOrThrow("schedule_days", null, d);
                for (ScheduleRules.Break rest : day.breaks) {
                    ContentValues b = new ContentValues();
                    b.put("schedule_id", id); b.put("weekday", day.weekday);
                    b.put("start_offset", rest.startOffset); b.put("end_offset", rest.endOffset);
                    db.insertOrThrow("schedule_breaks", null, b);
                }
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    void assign(String workerId, String scheduleId, String dateText) {
        LocalDate date;
        try { date = LocalDate.parse(dateText.trim()); }
        catch (java.time.DateTimeException error) { throw new WorkersDb.RuleError(R.string.invalid_effective_date); }
        db.beginTransaction();
        try {
            ZoneId zone;
            try (Cursor c = db.query("schedules", new String[]{"zone_id"}, "id = ?", new String[]{scheduleId}, null, null, null)) {
                if (!c.moveToFirst()) throw new WorkersDb.RuleError(R.string.schedule_error);
                zone = ZoneId.of(c.getString(0));
            }
            if (date.isBefore(LocalDate.now(zone)) || date.getYear() > 9999) throw new WorkersDb.RuleError(R.string.invalid_effective_date);
            long since = date.atStartOfDay(zone).toInstant().toEpochMilli();
            try (Cursor c = db.rawQuery("SELECT 1 FROM punches WHERE worker_id = ? AND occurred_at >= ? LIMIT 1", new String[]{workerId, Long.toString(since)})) {
                if (c.moveToFirst()) throw new WorkersDb.RuleError(R.string.assignment_has_punches);
            }
            // A shift that started on the previous day must retain its original assignment.
            try (Cursor c = db.rawQuery("SELECT kind FROM punches WHERE worker_id = ? ORDER BY seq DESC LIMIT 1", new String[]{workerId})) {
                if (date.equals(LocalDate.now(zone)) && c.moveToFirst() && !"OUT".equals(c.getString(0))) throw new WorkersDb.RuleError(R.string.assignment_has_punches);
            }
            ContentValues a = new ContentValues();
            a.put("worker_id", workerId); a.put("schedule_id", scheduleId); a.put("effective_date", date.toString()); a.put("created_at", System.currentTimeMillis());
            db.insertOrThrow("schedule_assignments", null, a);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    String assignmentSummary(String workerId) {
        try (Cursor c = db.rawQuery("SELECT s.name, a.effective_date,s.id FROM schedule_assignments a JOIN schedules s ON s.id = a.schedule_id WHERE a.worker_id = ? ORDER BY a.effective_date DESC LIMIT 1", new String[]{workerId})) {
            return c.moveToFirst() ? display(c.getString(2),c.getString(0)) + " · " + c.getString(1) : null;
        }
    }
    List<String> assignmentHistory(String workerId) {
        List<String> result = new ArrayList<>();
        try (Cursor c = db.rawQuery("SELECT s.name, a.effective_date FROM schedule_assignments a JOIN schedules s ON s.id = a.schedule_id WHERE a.worker_id = ? ORDER BY a.effective_date DESC", new String[]{workerId})) {
            while (c.moveToNext()) result.add(c.getString(1) + " · " + c.getString(0));
        }
        return result;
    }
}
