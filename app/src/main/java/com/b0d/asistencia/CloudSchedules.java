package com.b0d.asistencia;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

final class CloudSchedules {
 static String key(String id,int revision){return "web:"+id+":"+revision;}
 static void apply(SQLiteDatabase db,JSONObject data) throws Exception {
  db.beginTransaction();
  try {
   JSONArray versions=data.getJSONArray("versions");
   for(int i=0;i<versions.length();i++) {
    JSONObject v=versions.getJSONObject(i), definition=v.getJSONObject("definition");String id=key(v.getString("schedule_id"),v.getInt("revision"));
    try(Cursor c=db.rawQuery("SELECT 1 FROM schedules WHERE id=?",new String[]{id})){if(c.moveToFirst())continue;}
    List<ScheduleRules.Day> days=new ArrayList<>();JSONArray source=definition.getJSONArray("days");
    for(int j=0;j<source.length();j++) {
     JSONObject d=source.getJSONObject(j);JSONArray rests=d.getJSONArray("breaks");StringBuilder text=new StringBuilder();
     for(int k=0;k<rests.length();k++){if(k>0)text.append(';');JSONObject r=rests.getJSONObject(k);text.append(r.getString("start")).append('-').append(r.getString("end"));}
     days.add(new ScheduleRules.Day(d.getInt("weekday"),d.getString("start"),d.getString("end"),text.toString()));
    }
    ScheduleRules.validateWeek(days);ZoneId.of(definition.getString("zone"));
    String name=definition.getString("name");name=name.substring(0,Math.min(name.length(),24))+" · "+v.getString("schedule_id")+" v"+v.getInt("revision");
    ContentValues s=new ContentValues();s.put("id",id);s.put("name",name);s.put("mark_breaks",definition.getBoolean("markBreaks")?1:0);s.put("zone_id",definition.getString("zone"));s.put("created_at",System.currentTimeMillis());db.insertOrThrow("schedules",null,s);
    ContentValues display=new ContentValues();display.put("local_id",id);display.put("display_name",definition.getString("name")+" · v"+v.getInt("revision"));db.insertOrThrow("cloud_schedule_names",null,display);
    for(ScheduleRules.Day day:days){ContentValues d=new ContentValues();d.put("schedule_id",id);d.put("weekday",day.weekday);d.put("start_minute",day.start);d.put("end_minute",day.end);db.insertOrThrow("schedule_days",null,d);
     for(ScheduleRules.Break rest:day.breaks){ContentValues r=new ContentValues();r.put("schedule_id",id);r.put("weekday",day.weekday);r.put("start_offset",rest.startOffset);r.put("end_offset",rest.endOffset);db.insertOrThrow("schedule_breaks",null,r);}
    }
   }
   JSONArray assignments=data.getJSONArray("assignments");
   for(int i=0;i<assignments.length();i++){
    JSONObject a=assignments.getJSONObject(i);String remote=a.getString("id");
    try(Cursor c=db.rawQuery("SELECT 1 FROM cloud_assignments WHERE remote_id=?",new String[]{remote})){if(c.moveToFirst())continue;}
    String worker;
    try(Cursor c=db.rawQuery("SELECT local_id FROM cloud_workers WHERE remote_id=?",new String[]{a.getString("worker_id")})){if(!c.moveToFirst())continue;worker=c.getString(0);}
    String schedule=key(a.getString("schedule_id"),a.getInt("revision"));SchedulesRepository.Schedule s=new SchedulesRepository(db).get(schedule);if(s==null)throw new Exception("Missing schedule");
    LocalDate today=LocalDate.now(ZoneId.of(s.zone));LocalDate date=LocalDate.parse(a.getString("effective_date"));if(date.isBefore(today))date=today;
    long midnight=today.atStartOfDay(ZoneId.of(s.zone)).toInstant().toEpochMilli();
    if(date.equals(today)){
     boolean used;
     try(Cursor c=db.rawQuery("SELECT 1 FROM punches WHERE worker_id=? AND occurred_at>=? LIMIT 1",new String[]{worker,Long.toString(midnight)})){used=c.moveToFirst();}
     try(Cursor c=db.rawQuery("SELECT kind FROM punches WHERE worker_id=? ORDER BY seq DESC LIMIT 1",new String[]{worker})){if(c.moveToFirst()&&!"OUT".equals(c.getString(0)))used=true;}
     if(used)date=today.plusDays(1);
    }
    // Date changes only for an unseen assignment; a late download never rewrites a started shift.
    ContentValues values=new ContentValues();values.put("worker_id",worker);values.put("schedule_id",schedule);values.put("effective_date",date.toString());values.put("created_at",System.currentTimeMillis());
    int updated=db.update("schedule_assignments",values,"worker_id=? AND effective_date=?",new String[]{worker,date.toString()});if(updated==0)db.insertOrThrow("schedule_assignments",null,values);
    ContentValues ack=new ContentValues();ack.put("remote_id",remote);ack.put("local_date",date.toString());db.insertOrThrow("cloud_assignments",null,ack);
   }
   db.setTransactionSuccessful();
  }finally{db.endTransaction();}
 }
}
