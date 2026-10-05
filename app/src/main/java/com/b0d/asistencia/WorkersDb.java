package com.b0d.asistencia;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Private repository. Call only after administrative authorization, off the UI thread. */
final class WorkersDb extends SQLiteOpenHelper {
    private final Context context;
    static final class Worker {
        final String id, code, name;
        String scheduleSummary;
        boolean hasFace;
        final boolean active;
        Worker(String id, String code, String name, boolean active) {
            this.id = id; this.code = code; this.name = name; this.active = active;
        }
    }
    WorkersDb(Context context) {
        super(context.getApplicationContext(), "attendance.db", null, 8);
        this.context = context.getApplicationContext();
    }
    @Override public void onConfigure(SQLiteDatabase db) { db.setForeignKeyConstraintsEnabled(true); }
    @Override public void onCreate(SQLiteDatabase db) {
        applySchema(db, R.raw.workers_v1);
        applySchema(db, R.raw.attendance_v2);
        applySchema(db, R.raw.schedules_v3);
        applySchema(db, R.raw.calculations_v4);
        applySchema(db, R.raw.faces_v5);
        applySchema(db, R.raw.recognition_v6);
        applySchema(db, R.raw.cloud_v7);
        applySchema(db, R.raw.cloud_v8);
    }
    private void applySchema(SQLiteDatabase db, int resource) {
        StringBuilder sql = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                context.getResources().openRawResource(resource), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sql.append(line).append('\n');
        } catch (java.io.IOException error) { throw new IllegalStateException("Schema unavailable", error); }
        for (String statement : sql.toString().split(";")) {
            if (!statement.trim().isEmpty()) db.execSQL(statement);
        }
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 1 || newVersion > 8) throw new IllegalStateException("Explicit migration required; never drop worker data");
        if (oldVersion < 2) applySchema(db, R.raw.attendance_v2);
        if (oldVersion < 3) applySchema(db, R.raw.schedules_v3);
        if (oldVersion < 4) {
            applySchema(db, R.raw.calculations_v4);
            new AttendanceRepository(db).backfill();
        }
        if (oldVersion < 5) applySchema(db, R.raw.faces_v5);
        if (oldVersion < 6) applySchema(db, R.raw.recognition_v6);
        if (oldVersion < 7) applySchema(db, R.raw.cloud_v7);
        if (oldVersion < 8) applySchema(db, R.raw.cloud_v8);
    }
    List<Worker> list() {
        List<Worker> rows = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query("workers",
                new String[]{"id", "code", "name", "active"}, null, null, null, null,
                "active DESC, name COLLATE NOCASE, code")) {
            while (cursor.moveToNext()) rows.add(new Worker(cursor.getString(0), cursor.getString(1),
                    cursor.getString(2), cursor.getInt(3) == 1));
        }
        SchedulesRepository schedules = new SchedulesRepository(getReadableDatabase());
        for (Worker row : rows) {
            row.scheduleSummary = schedules.assignmentSummary(row.id);
            try (Cursor c = getReadableDatabase().rawQuery("SELECT 1 FROM face_profiles WHERE worker_id = ?", new String[]{row.id})) {
                row.hasFace = c.moveToFirst();
            }
        }
        return rows;
    }
    void add(String code, String name) {
        WorkerFields fields = new WorkerFields(code, name);
        SQLiteDatabase db = getWritableDatabase();
        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues();
            values.put("id", id); values.put("code", fields.code); values.put("name", fields.name);
            values.put("active", 1); values.put("created_at", now); values.put("updated_at", now);
            db.insertOrThrow("workers", null, values);
            event(db, id, "created", now);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    void setActive(String id, boolean active) {
        if (new CloudSync(context).linked()) throw new RuleError(R.string.cloud_managed_worker);
        SQLiteDatabase db = getWritableDatabase();
        long now = System.currentTimeMillis();
        db.beginTransaction();
        try {
            Punch last = lastPunch(db, id);
            if (!active && last != null && !"OUT".equals(last.kind)) throw new RuleError(R.string.close_shift_first);
            ContentValues values = new ContentValues();
            values.put("active", active ? 1 : 0); values.put("updated_at", now);
            int count = db.update("workers", values, "id = ? AND active != ?",
                    new String[]{id, active ? "1" : "0"});
            if (count != 1) throw new IllegalStateException("Worker missing or state changed");
            event(db, id, active ? "activated" : "deactivated", now);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    private void event(SQLiteDatabase db, String id, String action, long now) {
        ContentValues values = new ContentValues();
        values.put("worker_id", id); values.put("action", action);
        values.put("actor", "local_admin"); values.put("occurred_at", now);
        db.insertOrThrow("worker_events", null, values);
    }
    static final class RuleError extends RuntimeException {
        final int message;
        RuleError(int message) { this.message = message; }
    }
    static final class Punch {
        final String code, name, kind, zone;
        final long time;
        Punch(String code, String name, String kind, long time, String zone) {
            this.code = code; this.name = name; this.kind = kind; this.time = time; this.zone = zone;
        }
    }
    static final class CheckInState {
        final Worker worker;
        final Punch last;
        final AttendanceRepository.Summary summary;
        final WorkCalculator.Plan plan;
        CheckInState(Worker worker, Punch last, AttendanceRepository.Summary summary, WorkCalculator.Plan plan) {
            this.worker = worker; this.last = last; this.summary = summary; this.plan = plan;
        }
    }
    CheckInState findForClock(String rawCode) {
        String code = rawCode.trim().toUpperCase(java.util.Locale.ROOT);
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.query("workers", new String[]{"id", "code", "name", "active"},
                "code = ?", new String[]{code}, null, null, null)) {
            if (!cursor.moveToFirst()) throw new RuleError(R.string.worker_not_available);
            Worker worker = new Worker(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getInt(3) == 1);
            if (!worker.active) throw new RuleError(R.string.worker_not_available);
            Punch last = lastPunch(db, worker.id);
            AttendanceRepository reports = new AttendanceRepository(db);
            long now = System.currentTimeMillis();
            return new CheckInState(worker, last, reports.latest(worker.id, now),
                    reports.forAction(worker.id, last == null ? null : last.kind, now, java.time.ZoneId.systemDefault().getId()).plan);
        }
    }
    private Punch lastPunch(SQLiteDatabase db, String id) {
        try (Cursor cursor = db.query("punches", new String[]{"worker_code", "worker_name", "kind", "occurred_at", "zone_id"},
                "worker_id = ?", new String[]{id}, null, null, "seq DESC", "1")) {
            return cursor.moveToFirst() ? readPunch(cursor) : null;
        }
    }
    private Punch readPunch(Cursor cursor) {
        return new Punch(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getLong(3), cursor.getString(4));
    }
    List<Punch> recentPunches() {
        List<Punch> rows = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query("punches",
                new String[]{"worker_code", "worker_name", "kind", "occurred_at", "zone_id"},
                null, null, null, null, "seq DESC", "200")) {
            while (cursor.moveToNext()) rows.add(readPunch(cursor));
        }
        return rows;
    }
    Punch punch(String workerId, String kind) {
        return punch(workerId, kind, null, 0);
    }
    Punch punchFace(String workerId, String action, double score) {
        if (!Double.isFinite(score) || score < FaceMatchRules.MIN_SCORE || score > 1)
            throw new RuleError(R.string.face_unknown);
        return punch(workerId, null, action, score);
    }
    private Punch punch(String workerId, String kind, String action, double score) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            Worker worker;
            try (Cursor cursor = db.query("workers", new String[]{"id", "code", "name", "active"},
                    "id = ?", new String[]{workerId}, null, null, null)) {
                if (!cursor.moveToFirst()) throw new RuleError(R.string.worker_not_available);
                worker = new Worker(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getInt(3) == 1);
            }
            long now = System.currentTimeMillis();
            Punch last = lastPunch(db, workerId);
            if (action != null) {
                if (last != null && now >= last.time && now - last.time < 5000) throw new RuleError(R.string.face_too_soon);
                String previousAction = null;
                try (Cursor c = db.rawQuery("SELECT f.action FROM punches p LEFT JOIN facial_punch_details f ON f.seq=p.seq WHERE p.worker_id=? ORDER BY p.seq DESC LIMIT 1", new String[]{workerId})) {
                    if (c.moveToFirst()) previousAction = c.getString(0);
                }
                try { kind = FaceMatchRules.kind(action, last == null ? null : last.kind, previousAction); }
                catch (IllegalArgumentException e) { throw new RuleError(R.string.face_wrong_break); }
            }
            String zone = java.time.ZoneId.systemDefault().getId();
            AttendanceRepository reports = new AttendanceRepository(db);
            AttendanceRepository.Context context = reports.forAction(workerId, last == null ? null : last.kind, now, zone);
            PunchRules.Result result = PunchRules.validate(worker.active, last == null ? null : last.kind,
                    last == null ? 0 : last.time, kind, now, context.plan != null && context.plan.marked);
            if (result != PunchRules.Result.OK) throw new RuleError(result == PunchRules.Result.CLOCK ?
                    R.string.clock_error : result == PunchRules.Result.INACTIVE ? R.string.worker_not_available : R.string.sequence_error);
            ContentValues values = new ContentValues();
            values.put("event_id", UUID.randomUUID().toString()); values.put("worker_id", workerId);
            values.put("worker_code", worker.code); values.put("worker_name", worker.name);
            values.put("kind", kind); values.put("occurred_at", now); values.put("zone_id", zone);
            values.put("method", action == null ? "manual" : "facial");
            long seq = db.insertOrThrow("punches", null, values);
            if (action != null) {
                ContentValues detail = new ContentValues();
                detail.put("seq", seq); detail.put("action", action); detail.put("score", score); detail.put("model", FaceEngine.MODEL);
                db.insertOrThrow("facial_punch_details", null, detail);
            }
            if ("IN".equals(kind)) reports.bind(seq, context);
            db.setTransactionSuccessful();
            return new Punch(worker.code, worker.name, kind, now, zone);
        } finally { db.endTransaction(); }
    }
    void deleteWorker(String id) {
        if (new CloudSync(context).linked()) throw new RuleError(R.string.cloud_managed_worker);
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (lastPunch(db, id) != null) throw new RuleError(R.string.cannot_delete_history);
            String code;
            try (Cursor cursor = db.query("workers", new String[]{"code"}, "id = ?", new String[]{id}, null, null, null)) {
                if (!cursor.moveToFirst()) throw new RuleError(R.string.worker_not_available);
                code = cursor.getString(0);
            }
            ContentValues audit = new ContentValues();
            audit.put("worker_id", id); audit.put("worker_code", code);
            audit.put("deleted_at", System.currentTimeMillis()); audit.put("actor", "local_admin");
            db.insertOrThrow("deleted_workers", null, audit);
            db.delete("worker_events", "worker_id = ?", new String[]{id});
            db.delete("schedule_assignments", "worker_id = ?", new String[]{id});
            if (db.delete("workers", "id = ?", new String[]{id}) != 1) throw new IllegalStateException("Missing worker");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
}
