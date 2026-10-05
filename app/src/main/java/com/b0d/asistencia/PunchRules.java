package com.b0d.asistencia;

public final class PunchRules {
    public enum Result { OK, INVALID_TYPE, INACTIVE, SEQUENCE, CLOCK }
    public static Result validate(boolean active, String previous, long previousTime, String requested, long now) {
        return validate(active, previous, previousTime, requested, now, false);
    }
    public static Result validate(boolean active, String previous, long previousTime, String requested, long now, boolean markedBreaks) {
        if (!"IN".equals(requested) && !"OUT".equals(requested) && !"BREAK_START".equals(requested) && !"BREAK_END".equals(requested)) return Result.INVALID_TYPE;
        if (!active) return Result.INACTIVE;
        if (previous != null && now < previousTime) return Result.CLOCK;
        if ((previous == null || "OUT".equals(previous)) && "IN".equals(requested)) return Result.OK;
        if (("IN".equals(previous) || "BREAK_END".equals(previous)) && "OUT".equals(requested)) return Result.OK;
        if (markedBreaks && ("IN".equals(previous) || "BREAK_END".equals(previous)) && "BREAK_START".equals(requested)) return Result.OK;
        if (markedBreaks && "BREAK_START".equals(previous) && "BREAK_END".equals(requested)) return Result.OK;
        return Result.SEQUENCE;
    }
}
