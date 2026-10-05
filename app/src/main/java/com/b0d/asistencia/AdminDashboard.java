package com.b0d.asistencia;

import java.util.ArrayList;
import java.util.List;

/** Read-only dashboard; never changes attendance or its calculation rules. */
final class AdminDashboard {
    static final class Row {
        WorkersDb.Worker worker;
        long effective, target;
        String state;
    }
    final List<Row> rows = new ArrayList<>();
    final List<String> notices = new ArrayList<>();
    long overtime;
    final DashboardProgress progress = new DashboardProgress();
    boolean provisional;
    static AdminDashboard load(WorkersDb db) {
        AdminDashboard data = new AdminDashboard();
        AttendanceRepository reports = new AttendanceRepository(db.getReadableDatabase());
        long now = System.currentTimeMillis();
        for (WorkersDb.Worker worker : db.list()) {
            List<AttendanceRepository.Summary> summaries = reports.summaries(worker.id, now);
            for (AttendanceRepository.Summary s : summaries) {
                if (!s.result.invalid) data.overtime += Math.max(0, s.result.overtime);
                data.provisional |= s.result.provisional();
            }
            if (!worker.active) continue;
            AttendanceRepository.Context day = reports.choose(worker.id, now, java.time.ZoneId.systemDefault().getId());
            Row row = new Row(); row.worker = worker;
            row.target = day.plan == null ? 0 : day.plan.day.effectiveMinutes * 60000L;
            row.state = day.plan == null ? "Sin jornada asignada" : "Sin entrada";
            boolean marked = false;
            for (AttendanceRepository.Summary s : summaries) {
                if (!s.context.date.equals(day.date)) {
                    if (s.result.open) data.notices.add(worker.name + ": jornada anterior abierta");
                    continue;
                }
                marked = true;
                row.effective += s.result.invalid ? 0 : s.result.effective;
                if (s.result.invalid || s.result.missingBreaks) data.notices.add(worker.name + ": revisar marcaciones");
                if (s.result.late > 0) data.notices.add(worker.name + ": retardo de " + ((s.result.late + 59999) / 60000) + " min");
                if (s.result.resting) row.state = "En descanso";
                else if (s.result.open) row.state = "Trabajando";
                else if (!row.state.equals("Trabajando") && !row.state.equals("En descanso")) row.state = "Jornada cerrada";
            }
            if (!marked && day.plan != null && now > day.plan.at(day.plan.day.start))
                data.notices.add(worker.name + ": entrada pendiente");
            data.progress.add(row.effective, row.target);
            data.rows.add(row);
        }
        return data;
    }
}
