package com.b0d.asistencia;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Wall-clock schedule definitions; actual attendance calculations belong to a later layer. */
public final class ScheduleRules {
    public static final class Break {
        public final int startOffset, endOffset;
        Break(int startOffset, int endOffset) { this.startOffset = startOffset; this.endOffset = endOffset; }
    }
    public static final class Day {
        public final int weekday, start, end, effectiveMinutes;
        public final List<Break> breaks;
        public Day(int weekday, String startText, String endText, String breakText) {
            if (weekday < 1 || weekday > 7) throw new IllegalArgumentException("Día inválido.");
            this.weekday = weekday;
            this.start = parseTime(startText);
            int finish = parseTime(endText);
            if (finish == start) throw new IllegalArgumentException("Entrada y salida no pueden ser iguales.");
            this.end = finish < start ? finish + 1440 : finish;
            List<Break> parsed = new ArrayList<>();
            if (breakText != null && !breakText.trim().isEmpty()) {
                String[] segments = breakText.trim().split(";", -1);
                if (segments.length > 8) throw new IllegalArgumentException("Máximo 8 descansos por día.");
                for (String segment : segments) {
                    String[] pair = segment.trim().split("-", -1);
                    if (pair.length != 2) throw new IllegalArgumentException("Descansos: usa HH:mm-HH:mm separados por punto y coma.");
                    int from = Math.floorMod(parseTime(pair[0]) - start, 1440);
                    int to = Math.floorMod(parseTime(pair[1]) - start, 1440);
                    if (to <= from || to > end - start) throw new IllegalArgumentException("Los descansos deben estar dentro del turno y tener duración positiva.");
                    parsed.add(new Break(from, to));
                }
            }
            parsed.sort(Comparator.comparingInt(rest -> rest.startOffset));
            int previousEnd = -1, excluded = 0;
            for (Break rest : parsed) {
                if (rest.startOffset < previousEnd) throw new IllegalArgumentException("Los descansos no pueden superponerse.");
                excluded += rest.endOffset - rest.startOffset;
                previousEnd = rest.endOffset;
            }
            effectiveMinutes = end - start - excluded;
            if (effectiveMinutes <= 0) throw new IllegalArgumentException("Debe quedar tiempo efectivo de trabajo.");
            breaks = java.util.Collections.unmodifiableList(parsed);
        }
    }
    public static int parseTime(String text) {
        String value = text == null ? "" : text.trim();
        if (!value.matches("[0-2][0-9]:[0-5][0-9]")) throw new IllegalArgumentException("Usa hora de 24 horas: HH:mm.");
        int hour = Integer.parseInt(value.substring(0, 2));
        if (hour > 23) throw new IllegalArgumentException("La hora debe estar entre 00:00 y 23:59.");
        return hour * 60 + Integer.parseInt(value.substring(3));
    }
    public static String clock(int minute) {
        int normalized = Math.floorMod(minute, 1440);
        return String.format(java.util.Locale.ROOT, "%02d:%02d", normalized / 60, normalized % 60);
    }
    public static void validateWeek(List<Day> days) {
        if (days == null || days.isEmpty() || days.size() > 7) throw new IllegalArgumentException("Selecciona al menos un día laborable.");
        List<Day> ordered = new ArrayList<>(days);
        ordered.sort(Comparator.comparingInt(day -> day.weekday));
        for (int i = 0; i < ordered.size(); i++) {
            Day current = ordered.get(i), next = ordered.get((i + 1) % ordered.size());
            if (i + 1 < ordered.size() && current.weekday == next.weekday) throw new IllegalArgumentException("Día repetido.");
            int finish = (current.weekday - 1) * 1440 + current.end;
            int nextStart = (next.weekday - 1) * 1440 + next.start;
            if (i == ordered.size() - 1) nextStart += 7 * 1440;
            if (finish > nextStart) throw new IllegalArgumentException("Un turno nocturno se superpone con el siguiente día.");
        }
    }
}
