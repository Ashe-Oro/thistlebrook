# OWNER: grok-style lane. Measurable look features for gold vs render stills.
# usage: python3 tools/grok-style-metrics.py img...  -> JSON per image
import sys,json,colorsys
from PIL import Image
def feats(path):
    im=Image.open(path).convert('RGB').resize((320,200))
    px=list(im.getdata());n=len(px)
    hsv=[colorsys.rgb_to_hsv(*(c/255 for c in p)) for p in px]
    luma=[(0.2126*r+0.7152*g+0.0722*b)/255 for r,g,b in px]
    neonM=sum(1 for h,s,v in hsv if s>.45 and v>.55 and (h>.78 or h<.02))/n
    neonC=sum(1 for h,s,v in hsv if s>.45 and v>.55 and .45<h<.55)/n
    vio=sum(1 for h,s,v in hsv if .6<h<.8 and s>.2)/n
    # vertical sharpness profile: top/mid/bottom gradient energy
    g=im.convert('L');w,h=g.size;G=list(g.getdata())
    def energy(y0,y1):
        e=0;c=0
        for y in range(y0,y1):
            for x in range(1,w):
                e+=abs(G[y*w+x]-G[y*w+x-1]);c+=1
        return e/c
    top,mid,bot=energy(0,40),energy(80,120),energy(160,200)
    pal=im.quantize(6,method=Image.Quantize.MEDIANCUT).convert('RGB').getcolors(64000)
    pal=sorted(pal,reverse=True)[:6]
    cl=[luma[i] for i in range(n) if 85*320<=i<115*320 and 130<=i%320<190];cc=sum(cl)/len(cl)
    corner=sum(luma[i] for i in range(n) if (i%320<40 or i%320>279) and (i//320<25 or i//320>174))/sum(1 for i in range(n) if (i%320<40 or i%320>279) and (i//320<25 or i//320>174))
    return dict(meanLuma=round(sum(luma)/n,3),meanSat=round(sum(s for _,s,_ in hsv)/n,3),neonMagenta=round(neonM,4),neonCyan=round(neonC,4),violetShare=round(vio,3),tiltShift=round((top+bot)/2/max(mid,1e-6),3),cornerOverCentre=round(corner/max(cc,1e-6),3),palette=['#%02x%02x%02x'%c for _,c in pal])
print(json.dumps({p:feats(p) for p in sys.argv[1:]},indent=1))
