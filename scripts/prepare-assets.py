from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT.parent/'art-review-v2'
OUT=ROOT/'dist'/'assets'
OUT.mkdir(parents=True,exist_ok=True)
manifest={}
def save(im,name,size=400):
    im=im.convert('RGBA')
    box=im.getchannel('A').point(lambda p:255 if p>40 else 0).getbbox()
    if box: im=im.crop(box)
    im.thumbnail((size,size),Image.Resampling.LANCZOS)
    im.save(OUT/(name+'.webp'),'WEBP',quality=91,method=6)
    manifest[name]=list(im.size)
def grid(file,names,cols,rows,size=400):
    im=Image.open(SRC/file)
    for i,name in enumerate(names):
        x=i%cols;y=i//cols
        save(im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows))),name,size)
grid('07-ingredients.png',['bun-bottom','bun-top','raw-patty','patty','cheese','lettuce','tomato','pearls','tea','milk','foam'],4,3,300)
im=Image.open(SRC/'08-equipment.png')
boxes={'cup':(10,25,345,414),'lid':(360,168,720,412),'cup-pearls':(720,25,1055,414),'cup-tea':(1075,25,1417,414),'cup-milk':(1425,25,1774,414),'cup-mixed':(10,435,332,825),'tray':(325,596,767,832),'pan':(752,515,1128,834),'tea-tank':(1140,414,1434,832),'milk-tank':(1442,409,1768,835)}
for name,box in boxes.items():save(im.crop(box),name,420)
grid('03-character-states.png',['char-wait','char-curious','char-confused','char-happy','char-laugh-small','char-recover'],3,2,650)
grid('04-wardrobe.png',['outfit-original','outfit-apron','outfit-bow','outfit-chef','outfit-shades','outfit-party'],3,2,700)
grid('09-completed-dishes.png',['dish-'+str(i) for i in range(12)],4,3,260)
grid('10-failed-dishes.png',['fail-'+str(i) for i in range(6)],3,2,260)
save(Image.open(SRC/'01-neutral-video-based.png'),'char-neutral',900)
save(Image.open(SRC/'02-laugh-video-based.png'),'char-laugh',900)
im=Image.open(SRC/'11-kitchen-background.png').convert('RGB')
im.save(OUT/'kitchen.webp',quality=87,method=6)
(OUT/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
print('Prepared',len(manifest),'sprites and kitchen background')

