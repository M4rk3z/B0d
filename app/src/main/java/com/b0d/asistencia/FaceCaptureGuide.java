package com.b0d.asistencia;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.View;

/** Visual positioning aid only; the oval does not assert identity or depth. */
final class FaceCaptureGuide extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private int pose,completed,total=5;
    private boolean attention;
    FaceCaptureGuide(Context context){super(context);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
    void update(int direction,int count,int steps){pose=direction;completed=count;total=steps;attention=false;invalidate();}
    void attention(){attention=true;invalidate();}
    private float dp(float value){return value*getResources().getDisplayMetrics().density;}
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        float w=getWidth(),h=getHeight(),cx=w/2,cy=h*.43f;
        float ry=h*.34f,rx=Math.min(w*.28f,ry*.76f);
        RectF oval=new RectF(cx-rx,cy-ry,cx+rx,cy+ry);
        Path shade=new Path();shade.setFillType(Path.FillType.EVEN_ODD);
        shade.addRect(0,0,w,h,Path.Direction.CW);shade.addOval(oval,Path.Direction.CW);
        paint.setStyle(Paint.Style.FILL);paint.setColor(0x770b1828);canvas.drawPath(shade,paint);
        paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(3));
        paint.setColor(attention?0xffffbd59:0xff60e0be);canvas.drawOval(oval,paint);
        paint.setStyle(Paint.Style.FILL);paint.setTextAlign(Paint.Align.CENTER);paint.setTextSize(dp(42));
        paint.setColor(0xffffffff);
        if(pose!=0)canvas.drawText(pose>0?"←":"→",pose>0?cx-rx-dp(32):cx+rx+dp(32),cy+dp(12),paint);
        float spacing=dp(24),start=cx-(total-1)*spacing/2;
        for(int i=0;i<total;i++){
            paint.setColor(i<completed?0xff60e0be:i==completed?0xffffffff:0xff708295);
            canvas.drawCircle(start+i*spacing,h-dp(20),dp(i==completed?6:4),paint);
        }
    }
}
