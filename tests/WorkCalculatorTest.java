package com.b0d.asistencia;

import java.time.LocalDate;
import java.util.List;

public final class WorkCalculatorTest {
    private static int checks;
    private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); checks++; }
    private static WorkCalculator.Plan office(boolean marked) {
        return new WorkCalculator.Plan("s1", "Oficina", "America/Chicago", LocalDate.of(2026,10,5),
                new ScheduleRules.Day(1,"08:00","17:00","13:00-14:00"), marked);
    }
    private static WorkCalculator.Event event(WorkCalculator.Plan p, String kind, int minute) { return new WorkCalculator.Event(kind,p.at(minute)); }
    private static WorkCalculator.Result pair(WorkCalculator.Plan p,int in,int out) {
        return WorkCalculator.calculate(p,List.of(event(p,"IN",in),event(p,"OUT",out)),p.at(out+60));
    }
    private static void minutes(long actual,long expected,String name) { check(actual==expected*60000,name+": "+actual); }
    public static void main(String[] args) {
        WorkCalculator.Plan p=office(false);
        WorkCalculator.Result r=pair(p,480,1020);
        minutes(r.effective,480,"On-time effective"); minutes(r.excluded,60,"Automatic lunch"); minutes(r.overtime,0,"No overtime"); check(!r.provisional(),"Closed normal shift");
        r=pair(p,540,1020); minutes(r.effective,420,"Late short day"); minutes(r.late,60,"Late recorded separately"); minutes(r.overtime,0,"Late cannot create overtime");
        r=pair(p,540,1080); minutes(r.effective,480,"Late made up"); minutes(r.overtime,0,"After scheduled exit alone isn't overtime"); minutes(r.late,60,"Made up late still reported");
        r=pair(p,540,1140); minutes(r.effective,540,"Late extended day"); minutes(r.overtime,60,"Extra above net target"); minutes(r.ordinary,480,"Ordinary capped");
        r=pair(p,810,1020); minutes(r.excluded,30,"Only intersecting lunch"); minutes(r.effective,180,"No full-lunch overdeduction");
        r=pair(p,480,720); minutes(r.excluded,0,"No future lunch deduction");
        r=WorkCalculator.calculate(p,List.of(event(p,"IN",480),event(p,"OUT",720),event(p,"IN",840),event(p,"OUT",1140)),p.at(1200));
        minutes(r.effective,540,"Aggregate split presence"); minutes(r.overtime,60,"Single target across entries"); minutes(r.late,0,"Only first arrival is tardiness");
        r=WorkCalculator.calculate(p,List.of(event(p,"IN",480)),p.at(810));
        minutes(r.effective,300,"Ongoing automatic lunch"); check(r.open&&r.provisional(),"Open is provisional");
        WorkCalculator.Plan m=office(true);
        r=WorkCalculator.calculate(m,List.of(event(m,"IN",480),event(m,"BREAK_START",780),event(m,"BREAK_END",825),event(m,"OUT",1020)),m.at(1080));
        minutes(r.excluded,45,"Actual marked break"); minutes(r.effective,495,"Marked net"); minutes(r.overtime,15,"Actual short break yields real work"); check(!r.missingBreaks&&!r.provisional(),"Complete marked day");
        r=pair(m,480,1020); check(r.missingBreaks&&r.provisional(),"Unmarked scheduled rest is an incident");
        r=WorkCalculator.calculate(m,List.of(event(m,"IN",480),event(m,"BREAK_START",780)),m.at(870));
        minutes(r.effective,300,"Open rest not work"); check(r.open&&r.resting,"Rest state");
        r=WorkCalculator.calculate(m,List.of(event(m,"IN",480),event(m,"BREAK_START",780),event(m,"OUT",840)),m.at(900)); check(r.invalid,"Exit without return is incomplete");
        r=WorkCalculator.calculate(p,List.of(event(p,"OUT",600)),p.at(700)); check(r.invalid,"Orphan exit");
        r=WorkCalculator.calculate(p,List.of(event(p,"IN",600),event(p,"OUT",500)),p.at(700)); check(r.invalid,"Clock regression");
        r=WorkCalculator.calculate(p,List.of(event(p,"IN",600)),p.at(500)); check(r.invalid,"Now before last event");
        r=WorkCalculator.calculate(null,List.of(event(p,"IN",480),event(p,"OUT",1020)),p.at(1100)); minutes(r.effective,540,"No schedule preserves presence"); check(r.overtime==-1&&r.late==-1,"No fabricated overtime or late");
        WorkCalculator.Plan night=new WorkCalculator.Plan("n","Noche","America/Chicago",LocalDate.of(2026,10,5),new ScheduleRules.Day(1,"22:00","06:00","02:00-02:30"),false);
        r=pair(night,1320,1800); minutes(r.effective,450,"Night net"); minutes(r.overtime,0,"Night threshold");
        WorkCalculator.Plan fall=new WorkCalculator.Plan("n","Noche","America/Chicago",LocalDate.of(2026,10,31),new ScheduleRules.Day(6,"22:00","06:00","02:00-02:30"),false);
        r=pair(fall,1320,1800); minutes(r.effective,510,"Fall DST elapsed time"); minutes(r.overtime,60,"DST against nominal target");
        WorkCalculator.Plan spring=new WorkCalculator.Plan("n","Noche","America/Chicago",LocalDate.of(2026,3,7),new ScheduleRules.Day(6,"22:00","06:00","03:00-03:30"),false);
        r=pair(spring,1320,1800); minutes(r.effective,390,"Spring DST elapsed time"); minutes(r.overtime,0,"Spring no fabricated time");
        check(PunchRules.validate(true,"IN",100,"BREAK_START",200,true)==PunchRules.Result.OK,"Start rest");
        check(PunchRules.validate(true,"IN",100,"BREAK_START",200,false)==PunchRules.Result.SEQUENCE,"Automatic disallows rest marks");
        check(PunchRules.validate(true,"BREAK_START",100,"OUT",200,true)==PunchRules.Result.SEQUENCE,"Must return before exit");
        check(PunchRules.validate(true,"BREAK_START",100,"BREAK_END",200,true)==PunchRules.Result.OK,"Return rest");
        check(PunchRules.validate(true,"BREAK_END",100,"OUT",200,true)==PunchRules.Result.OK,"Exit after rest");
        check(PunchRules.validate(true,"BREAK_START",100,"BREAK_START",200,true)==PunchRules.Result.SEQUENCE,"No duplicate break");
        check(PunchRules.validate(true,"OUT",100,"BREAK_END",200,true)==PunchRules.Result.SEQUENCE,"No return outside shift");
        System.out.println("PASS: "+checks+" calculation and break checks");
    }
}
