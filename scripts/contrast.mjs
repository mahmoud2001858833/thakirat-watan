const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((m,n)=>n-m);return ((x+.05)/(y+.05)).toFixed(2)};
const sets={light:{bg:'#F3EDE2',surface:'#EAE2D3',fg:['#1F1E1C','#5A554D','#9E4A3C','#4F5A2E','#7A5B22']},dark:{bg:'#141413',surface:'#1E1D1B',fg:['#EDE6D8','#A8A194','#E39C8A','#AEBB7E','#D8BC84']}};
for(const[k,s]of Object.entries(sets))for(const f of s.fg)console.log(k,f,'bg',R(f,s.bg),'surf',R(f,s.surface));
