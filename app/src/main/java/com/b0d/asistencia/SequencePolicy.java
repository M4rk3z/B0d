package com.b0d.asistencia;
import android.content.Context;
import org.json.JSONObject;
final class SequencePolicy {
 static void save(Context context,JSONObject value){
  context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).edit().putString("rules",value.toString()).apply();
 }
 static boolean allowed(Context context,String action,long elapsed){
  try{
   JSONObject rules=new JSONObject(context.getSharedPreferences("sequence-policy",Context.MODE_PRIVATE).getString("rules","{}"));
   JSONObject rule=rules.optJSONObject("MEAL".equals(action)?"meal":"rest");
   return SequenceRules.allowed(rule==null||rule.getBoolean("enabled"),rule==null?0:rule.getInt("from"),rule==null?1440:rule.getInt("to"),elapsed);
  }catch(Exception e){return false;}
 }
}
