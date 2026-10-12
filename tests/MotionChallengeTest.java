package com.b0d.asistencia;
public final class MotionChallengeTest {
    private static void check(boolean value){if(!value)throw new AssertionError();}
    public static void main(String[] args){
        for(boolean enrollment:new boolean[]{true,false}){
            MotionChallenge challenge=new MotionChallenge(enrollment);
            check(challenge.poses.length==(enrollment?5:3));
            long time=0;
            for(int pose:challenge.poses){
                float yaw=pose*24;
                check(!challenge.observe(yaw,true,time));
                check(!challenge.observe(yaw,false,time+500));
                check(!challenge.observe(yaw,true,time+600));
                check(!challenge.observe(yaw,true,time+900));
                check(challenge.observe(yaw,true,time+1200));
                time+=2000;
            }
            check(!challenge.observe(0,true,time));
        }
        MotionChallenge challenge=new MotionChallenge(true);
        check(!challenge.observe(Float.NaN,true,0));
        check(!challenge.observe(80,true,1000));
        check(challenge.index==0);
        System.out.println("PASS motion: both sequences, stable holds, quality interruption, invalid angles and completion");
    }
}
