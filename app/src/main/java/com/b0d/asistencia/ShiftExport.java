package com.b0d.asistencia;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONObject;
import org.json.JSONArray;
final class ShiftExport {
 static JSONObject context(SQLiteDatabase db,long seq,String worker,long time,String zone) throws Exception {
  AttendanceRepository.Context c=new AttendanceRepository(db).forEntry(seq,worker,time,zone);
  JSONObject out=new JSONObject().put("date",c.date.toString()).put("zone",c.zone).put("schedule",c.scheduleId==null?JSONObject.NULL:c.scheduleId);
  if(c.plan==null)return out.put("plan",JSONObject.NULL);
  JSONArray rests=new JSONArray();for(ScheduleRules.Break rest:c.plan.day.breaks)rests.put(new JSONArray().put(c.plan.at(c.plan.day.start+rest.startOffset)).put(c.plan.at(c.plan.day.start+rest.endOffset)));
  return out.put("plan",new JSONObject().put("start",c.plan.at(c.plan.day.start)).put("end",c.plan.at(c.plan.day.end)).put("target",c.plan.day.effectiveMinutes*60000L).put("marked",c.plan.marked).put("rests",rests));
 }
}
