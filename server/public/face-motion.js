export function poseMatches(pose,ratio){return Number.isFinite(ratio)&&(pose==='center'?Math.abs(ratio)<0.18:pose==='left'?ratio>0.28&&ratio<0.9:ratio< -0.28&&ratio> -0.9);}
export class MotionSteps {
 constructor(poses){this.poses=poses;this.index=0;this.since=null;this.frames=0;}
 observe(ratio,valid,now){
  if(!valid||!poseMatches(this.poses[this.index],ratio)){this.since=null;this.frames=0;return false;}
  if(this.since===null)this.since=now;this.frames++;
  if(this.frames<3||now-this.since<550)return false;
  this.index++;this.since=null;this.frames=0;return true;
 }
}
