package com.b0d.asistencia;
import java.time.LocalDate;
import java.util.List;
public final class WorkCalculatorTest {
 static void check(boolean ok){if(!ok)throw new AssertionError("Sequence calculation");}
 static WorkCalculator.Event e(String kind,long hour){return new WorkCalculator.Event(kind,hour*3600000L);}
 public static void main(String[] args){
  WorkCalculator.Result r=WorkCalculator.calculate(null,List.of(e("IN",8),e("BREAK_START",12),e("BREAK_END",13),e("OUT",17)),18*3600000L);
  check(r.effective==9*3600000L&&r.excluded==0&&r.ordinary==8*3600000L&&r.overtime==3600000L&&!r.provisional());
  r=WorkCalculator.calculate(null,List.of(e("IN",8),e("OUT",16)),18*3600000L);check(r.effective==8*3600000L&&!r.missingBreaks);
  r=WorkCalculator.calculate(null,List.of(e("IN",22),e("OUT",30)),31*3600000L);check(r.effective==8*3600000L);
  r=WorkCalculator.calculate(null,List.of(e("IN",8),e("BREAK_START",12),e("OUT",17)),18*3600000L);check(r.invalid);
  r=WorkCalculator.calculate(null,List.of(e("OUT",17)),18*3600000L);check(r.invalid);
  r=WorkCalculator.calculate(null,List.of(e("IN",8)),10*3600000L);check(r.open&&r.effective==2*3600000L);
  r=WorkCalculator.calculate(null,List.of(e("IN",8),e("OUT",7)),10*3600000L);check(r.invalid);
  for(LocalDate date:List.of(LocalDate.of(2026,10,31),LocalDate.of(2026,3,7))){
   WorkCalculator.Plan p=new WorkCalculator.Plan("legacy","Legacy","America/Chicago",date,new ScheduleRules.Day(date.getDayOfWeek().getValue(),"22:00","06:00",""),false);
   long from=p.at(1320),to=p.at(1800);
   r=WorkCalculator.calculate(p,List.of(new WorkCalculator.Event("IN",from),new WorkCalculator.Event("OUT",to)),to);
   check(r.effective==to-from&&r.ordinary==Math.min(8*3600000L,to-from));
  }
  check(PunchRules.validate(true,"IN",1,"BREAK_START",2)==PunchRules.Result.OK);
  check(PunchRules.validate(true,"BREAK_START",1,"OUT",2)==PunchRules.Result.SEQUENCE);
  check(PunchRules.validate(true,"BREAK_START",1,"BREAK_END",2)==PunchRules.Result.OK);
  check(SequenceRules.allowed(true,120,240,120*60000L));
  check(SequenceRules.allowed(true,120,240,240*60000L));
  check(!SequenceRules.allowed(true,120,240,119*60000L));
  check(!SequenceRules.allowed(true,120,240,241*60000L));
  check(!SequenceRules.allowed(false,0,1440,10*60000L));
  System.out.println("PASS: sequence, pause limits, overnight, DST and eight-hour cap");
 }
}
