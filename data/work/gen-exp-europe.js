const fs=require('fs');global.window={};
eval(fs.readFileSync('data/conferences.js','utf8'));
let ex=window.HOGGY_CONFERENCES.slice();
for(const f of fs.readdirSync('data/shards')){if(f==='exp-europe.json')continue;try{const j=JSON.parse(fs.readFileSync('data/shards/'+f,'utf8'));if(Array.isArray(j))ex.push(...j)}catch(e){}}
const C={Amsterdam:['Netherlands','NL',52.37,4.90],Rotterdam:['Netherlands','NL',51.92,4.48],Utrecht:['Netherlands','NL',52.09,5.12],Maastricht:['Netherlands','NL',50.85,5.69],Papendal:['Netherlands','NL',51.97,5.87],Veldhoven:['Netherlands','NL',51.42,5.40],
Barcelona:['Spain','ES',41.39,2.17],Madrid:['Spain','ES',40.42,-3.70],Valencia:['Spain','ES',39.47,-0.38],Seville:['Spain','ES',37.39,-5.98],Bilbao:['Spain','ES',43.26,-2.93],Malaga:['Spain','ES',36.72,-4.42],
Paris:['France','FR',48.86,2.35],Lyon:['France','FR',45.76,4.84],Lille:['France','FR',50.63,3.06],Nantes:['France','FR',47.22,-1.55],Strasbourg:['France','FR',48.57,7.75],
London:['United Kingdom','GB',51.51,-0.13],Manchester:['United Kingdom','GB',53.48,-2.24],Birmingham:['United Kingdom','GB',52.49,-1.89],Glasgow:['United Kingdom','GB',55.86,-4.25],Edinburgh:['United Kingdom','GB',55.95,-3.19],Liverpool:['United Kingdom','GB',53.41,-2.98],Harrogate:['United Kingdom','GB',53.99,-1.54],Brighton:['United Kingdom','GB',50.82,-0.14],Telford:['United Kingdom','GB',52.68,-2.45],Cardiff:['United Kingdom','GB',51.48,-3.18],Newcastle:['United Kingdom','GB',54.98,-1.62],
Berlin:['Germany','DE',52.52,13.40],Munich:['Germany','DE',48.14,11.58],Hamburg:['Germany','DE',53.55,9.99],Leipzig:['Germany','DE',51.34,12.37],Dusseldorf:['Germany','DE',51.23,6.78],Mannheim:['Germany','DE',49.49,8.47],Nuremberg:['Germany','DE',49.45,11.08],Stuttgart:['Germany','DE',48.78,9.18],Erlangen:['Germany','DE',49.60,11.00],Dresden:['Germany','DE',51.05,13.74],
Vienna:['Austria','AT',48.21,16.37],Salzburg:['Austria','AT',47.81,13.04],Graz:['Austria','AT',47.07,15.44],
Copenhagen:['Denmark','DK',55.68,12.57],Aarhus:['Denmark','DK',56.16,10.20],Stockholm:['Sweden','SE',59.33,18.07],Gothenburg:['Sweden','SE',57.71,11.97],Helsinki:['Finland','FI',60.17,24.94],
Brussels:['Belgium','BE',50.85,4.35],Ghent:['Belgium','BE',51.05,3.72],Warsaw:['Poland','PL',52.23,21.01],Krakow:['Poland','PL',50.06,19.94],Prague:['Czechia','CZ',50.08,14.44],Brno:['Czechia','CZ',49.20,16.61],
Athens:['Greece','GR',37.98,23.73],Lisbon:['Portugal','PT',38.72,-9.14],Porto:['Portugal','PT',41.15,-8.61],Vilamoura:['Portugal','PT',37.08,-8.12],Dublin:['Ireland','IE',53.35,-6.26],Galway:['Ireland','IE',53.27,-9.05],Cork:['Ireland','IE',51.90,-8.47],
Milan:['Italy','IT',45.46,9.19],Rome:['Italy','IT',41.90,12.50],Rimini:['Italy','IT',44.06,12.57],Florence:['Italy','IT',43.77,11.26],Naples:['Italy','IT',40.85,14.27],Bologna:['Italy','IT',44.49,11.34],
Geneva:['Switzerland','CH',46.20,6.14],Basel:['Switzerland','CH',47.56,7.59],Bern:['Switzerland','CH',46.95,7.45],Lausanne:['Switzerland','CH',46.52,6.63],Lugano:['Switzerland','CH',46.01,8.96],
Budapest:['Hungary','HU',47.50,19.04],Istanbul:['Turkey','TR',41.01,28.98]};
const MAP=[['fuer','für'],['Gynaekologie','Gynäkologie'],['Orthopaedie','Orthopädie'],['Paediatr','Pädiatr'],['Gefaesschirurgie','Gefäßchirurgie'],['Gefaessmedizin','Gefäßmedizin'],['Gefaess','Gefäß'],['Roentgen','Röntgen'],['Haematologie','Hämatologie'],['Aesthetischen','Ästhetischen'],['Praevention','Prävention'],['Interdisziplinaere','Interdisziplinäre'],['Anaesthesiologie','Anästhesiologie'],['Anaesthesie','Anästhesie'],['Oesterreichische','Österreichische'],['OEKG','ÖKG'],['OEGHO','ÖGHO'],['Lakar','Läkar'],['Societe','Société'],['Congres','Congrès'],['Societa','Società'],['Francaise','Française'],['Francais','Français'],['Medecine','Médecine'],['Anesthesie','Anesthésie'],['Reanimation','Réanimation'],['Journees','Journées'],['Reunion','Réunion'],['Geriatrie','Gériatrie'],['Hepato','Hépato'],['Therapie','Thérapie'],['College','Collège'],['Gynecologues','Gynécologues'],['Obstetriciens','Obstétriciens'],['Espanola','Española'],['Cardiologia','Cardiología'],['Atencion','Atención'],['Medicos','Médicos'],['Hematologia','Hematología'],['Reanimacion','Reanimación'],['Anestesiologia','Anestesiología'],['Ginecologia','Ginecología'],['Endocrinologia','Endocrinología'],['Nutricion','Nutrición'],['Neurologia','Neurología'],['Patologia','Patología'],['Dermatologia','Dermatología'],['Cirugia','Cirugía'],['Ortopedica','Ortopédica'],['Traumatologia','Traumatología'],['Geriatria','Geriatría'],['Nefrologia','Nefrología'],['Urologia','Urología'],['Oncologia','Oncología'],['Asociacion','Asociación'],['Gerontologia','Gerontología'],['Venereologia','Venereología'],['Critica','Crítica'],['Ceska kardiologicka spolecnost','Česká kardiologická společnost'],['Dermatologia','Dermatología']];
const fix=s=>{for(const [a,b] of MAP)s=s.split(a).join(b);return s};
const MN=['','January','February','March','April','May','June','July','August','September','October','November','December'];
const ymd=d=>d.toISOString().slice(0,10);
function dateFor(y,m,n,wd,span){let d=new Date(Date.UTC(y,m-1,7*(n-1)+1));while(d.getUTCDay()!==wd)d.setUTCDate(d.getUTCDate()+1);const s=new Date(d);d.setUTCDate(d.getUTCDate()+span-1);return [ymd(s),ymd(d)]}
ex=ex.filter(r=>r&&r.id&&r.start&&r.name);
const norm=s=>s.toLowerCase().replace(/-20\d\d$/,'');
const exIds=new Set(ex.map(r=>norm(r.id)+'|'+r.start.slice(0,4)));
const exNames=ex.map(r=>[r.name.toLowerCase(),r.start.slice(0,4)]);
const out=[],dropped=[];const seen=new Set();
for(const line of fs.readFileSync('data/work/exp-europe-src.txt','utf8').split('\n').filter(Boolean)){
 const [key,name0,org0,spec,cityS,M,n,wd,span,yrs,url]=line.split('|');
 const name=fix(name0),org=fix(org0);
 const cities=cityS.split('/');
 [2027,2028].forEach((y,i)=>{
  if(yrs==='O'&&y!==2027)return; if(yrs==='E'&&y!==2028)return;
  const city=cities[i]||cities[0]; const c=C[city]; if(!c)throw new Error('city '+city);
  const id=key+'-'+y;
  const nl=name.toLowerCase();
  const hit=exIds.has(key+'|'+y)||exNames.some(([en,ey])=>ey==String(y)&&(en.includes(nl)||(nl.length>8&&nl.includes(en))));
  if(hit){dropped.push(id);return}
  if(seen.has(id))throw new Error('dup '+id);seen.add(id);
  const [s,e]=dateFor(y,+M,+n,+wd,+span);
  const rot=cities.length>1?' (host city may rotate)':'';
  const cadence=yrs==='B'?'annual':'biennial';
  out.push({id,name:name+' '+y,organiser:org,specialty:spec,city,country:c[0],countryCode:c[1],region:'Europe',lat:c[2],lng:c[3],start:s,end:e,format:'In-person',cpdHours:0,cpdBody:'',priceFrom:0,attendees:0,url,
   blurb:name+' is the '+cadence+' meeting of the '+org+', usually held in '+MN[+M]+'; '+city+' is the likely host city'+rot+'. Dates expected; not yet announced.',
   datesConfirmed:false,sourceUrl:url});
 });
}
fs.writeFileSync('data/shards/exp-europe.json',JSON.stringify(out,null,1));
console.log('rows',out.length,'dropped',dropped.length);console.log(dropped.join(' '));
