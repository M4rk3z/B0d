package com.b0d.asistencia;
import java.security.SecureRandom;
/** RGB motion challenge, not a depth sensor or certified spoof detector. */
final class MotionChallenge {
 final int[] poses;int index;private long since=-1;private int frames;
 MotionChallenge(boolean enrollment){int side=new SecureRandom().nextBoolean()?1:-1;poses=enrollment?new int[]{0,side,0,-side,0}:new int[]{0,side,0};}
 boolean observe(float yaw,boolean quality,long now){
  boolean pose=index<poses.length&&(poses[index]==0?Math.abs(yaw)<10:poses[index]>0?yaw>=18&&yaw<=32:yaw<=-18&&yaw>=-32);
  if(!quality||!pose){resetHold();return false;}
  if(since<0)since=now;frames++;
  if(frames<2||now-since<500)return false;index++;resetHold();return true;
 }
 void resetHold(){since=-1;frames=0;}
 String prompt(){return (index+1)+"/"+poses.length+" · "+(poses[index]==0?"Mira al frente":poses[index]>0?"Gira ligeramente a tu izquierda ←":"Gira ligeramente a tu derecha →");}
}
