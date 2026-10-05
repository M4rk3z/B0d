package com.b0d.asistencia;

import java.util.List;

public final class ScheduleRulesTest {
    private static int checks;
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    private static void reject(Runnable action) {
        try { action.run(); throw new AssertionError("Invalid schedule accepted"); }
        catch (IllegalArgumentException expected) { checks++; }
    }
    public static void main(String[] args) {
        ScheduleRules.Day office = new ScheduleRules.Day(1, "08:00", "17:00", "13:00-14:00");
        check(office.effectiveMinutes == 480, "8 effective hours");
        ScheduleRules.Day multiple = new ScheduleRules.Day(1, "08:00", "17:00", "16:00-16:15;13:00-14:00;10:00-10:15");
        check(multiple.effectiveMinutes == 450, "Multiple excluded intervals");
        check(multiple.breaks.get(0).startOffset == 120, "Sort intervals");
        ScheduleRules.Day night = new ScheduleRules.Day(7, "22:00", "06:00", "23:30-00:15;03:00-03:15");
        check(night.end == 1800 && night.effectiveMinutes == 420, "Night shift across midnight");
        check(night.breaks.get(0).endOffset == 135, "Night break offset");
        check(new ScheduleRules.Day(1, "00:00", "08:00", "").effectiveMinutes == 480, "No breaks");
        check(new ScheduleRules.Day(1, "08:00", "00:00", "23:00-00:00").effectiveMinutes == 900, "Break ending at midnight");
        check(new ScheduleRules.Day(1, "08:00", "17:00", "12:00-12:30;12:30-13:00").effectiveMinutes == 480, "Adjacent breaks");
        check(ScheduleRules.clock(1500).equals("01:00"), "Normalize next-day time");
        reject(() -> ScheduleRules.parseTime("24:00"));
        reject(() -> ScheduleRules.parseTime("08:60"));
        reject(() -> ScheduleRules.parseTime("8:00"));
        reject(() -> ScheduleRules.parseTime(null));
        reject(() -> new ScheduleRules.Day(0, "08:00", "17:00", ""));
        reject(() -> new ScheduleRules.Day(8, "08:00", "17:00", ""));
        reject(() -> new ScheduleRules.Day(1, "08:00", "08:00", ""));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "07:00-08:00"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "16:00-18:00"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "13:00-14:00;13:30-14:30"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "13:00-13:00"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "08:00-17:00"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "13:00-14:00;"));
        reject(() -> new ScheduleRules.Day(1, "08:00", "17:00", "comida"));
        reject(() -> ScheduleRules.validateWeek(List.of()));
        reject(() -> ScheduleRules.validateWeek(List.of(office, office)));
        reject(() -> ScheduleRules.validateWeek(List.of(night, new ScheduleRules.Day(1, "05:00", "12:00", ""))));
        reject(() -> ScheduleRules.validateWeek(List.of(new ScheduleRules.Day(1, "22:00", "06:00", ""), new ScheduleRules.Day(2, "05:59", "12:00", ""))));
        ScheduleRules.validateWeek(List.of(night, new ScheduleRules.Day(1, "06:00", "12:00", "")));
        checks++;
        ScheduleRules.validateWeek(List.of(office));
        checks++;
        System.out.println("PASS: " + checks + " schedule policy checks");
    }
}
