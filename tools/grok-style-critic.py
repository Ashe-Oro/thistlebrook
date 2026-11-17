# OWNER: grok-style lane. Blind harsh critic: a fresh, separate model call per
# view (no shared context with the builder), randomised A/B order, gold frame
# as the target. usage: python3 tools/grok-style-critic.py <round> <old-tag> <v2-tag> [views]
import os,sys,json,base64,random,urllib.request,io
from PIL import Image
rnd,oldtag,newtag=sys.argv[1:4];views=(sys.argv[4] if len(sys.argv)>4 else 'wide-day,wide-sunset,wide-night,close-night').split(',')
D='shots/grok-style';GOLD={'day':'gold/gold-day.jpg','sunset':'gold/gold-sunset.jpg','night':'gold/gold-night.jpg'}
def img(p):
    im=Image.open(os.path.join(D,p)).convert('RGB');im.thumbnail((1024,1024));b=io.BytesIO();im.save(b,'JPEG',quality=88)
    return {'type':'image_url','image_url':{'url':'data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode()}}
out=[]
for v in views:
    cam,t=v.split('-');pair=[('old',f'{oldtag}-old-{v}.png'),('v2',f'{newtag}-v2-{v}.png')];random.shuffle(pair)
    prompt=("You are a harsh, blind art-direction critic for a game. Image 1 is the GOLD target concept: a cyberpunk miniature-diorama look "
      "(deep blue-violet base, neon magenta/cyan accents, emissive signs/windows, wet sheen, haze, bloom, tilt-shift, tactile model craft). "
      "Images 2 (A) and 3 (B) are two real-time renders of the same town"+(" (a closer camera than the gold)" if cam=='close' else "")+". You do not know which is newer. "
      "Judge which render is closer to the gold's art direction and better as a finished frame. Be specific and harsh. Reply ONLY JSON: "
      '{"winner":"A"|"B","scoreA":0-10,"scoreB":0-10,"winnerCloseToGold":0-10,"why":"<=60 words","fixes":["top 3 concrete fixes for the winner"]}')
    body={'model':'gpt-5.2','messages':[{'role':'user','content':[{'type':'text','text':prompt},img(GOLD[t]),{'type':'text','text':'A:'},img(pair[0][1]),{'type':'text','text':'B:'},img(pair[1][1])]}]}
    req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+os.environ['OPENAI_API_KEY'],'Content-Type':'application/json'})
    txt=json.load(urllib.request.urlopen(req,timeout=300))['choices'][0]['message']['content']
    j=json.loads(txt[txt.index('{'):txt.rindex('}')+1])
    lab={'A':pair[0][0],'B':pair[1][0]}
    rec={'round':rnd,'view':v,'order':[pair[0][0],pair[1][0]],'winner':lab[j['winner']],'score':{lab['A']:j['scoreA'],lab['B']:j['scoreB']},'closeToGold':j['winnerCloseToGold'],'why':j['why'],'fixes':j['fixes']}
    out.append(rec);print(json.dumps(rec))
json.dump(out,open(f'{D}/critic-{rnd}.json','w'),indent=1)
