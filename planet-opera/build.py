import base64, sys, os
src=open('shell.html',encoding='utf-8').read()
three=open('three.bundle.js').read()
def b64(p): return 'data:image/jpeg;base64,'+base64.b64encode(open(p,'rb').read()).decode()
tex="const TEX={day:'%s',lights:'%s',water:'%s',topo:'%s'};"%tuple(b64('tex/%s.jpg'%n) for n in ['day','lights','water','topo'])
main=open('main.js').read()
assert '</script' not in three and '</script' not in main
src=src.replace('<!--SCRIPTS-->','<script>/* three.js (MIT) */'+three+'</script>\n<script>'+tex+'</script>\n<script>\n'+main+'\n</script>')
out='/home/claude/out/Planet_Opera_Draft_04_ORBEATS.html'
open(out,'w',encoding='utf-8').write(src);print(out,os.path.getsize(out)//1024,'KB')
