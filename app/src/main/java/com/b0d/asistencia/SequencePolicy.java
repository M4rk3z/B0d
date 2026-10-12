package com.b0d.asistencia;
import android.content.Context;
import org.json.JSONObject;
final class SequencePolicy {
 static void save(Context context,JSONObject value){
  context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).edit().putString("rules",value.toString()).apply();
 }
 static void saveWorker(Context context,String worker,JSONObject value){
  context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).edit().putBoolean(worker+"-meal",value.optBoolean("meal_enabled",true)).putBoolean(worker+"-rest",value.optBoolean("rest_enabled",true)).apply();
 }
 static boolean allowed(Context context,String worker,String action,long elapsed){
  try{
   JSONObject rules=new JSONObject(context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).getString("rules","{}"));
   JSONObject rule=rules.optJSONObject("MEAL".equals(action)?"meal":"rest");
   boolean enabled=context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).getBoolean(worker+("MEAL".equals(action)?"-meal":"-rest"),rule==null||rule.getBoolean("enabled"));
   return SequenceRules.allowed(enabled,rule==null?0:rule.getInt("from"),rule==null?1440:rule.getInt("to"),elapsed);
  }catch(Exception e){return false;}
 }
}
