package com.b0d.asistencia;
public final class SequenceRules {
 public static boolean allowed(boolean enabled,int from,int to,long elapsed){
  return enabled && elapsed>=from*60000L && elapsed<=to*60000L;
 }
}
