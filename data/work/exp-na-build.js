global.window={};require('./../conferences.js');
const fs=require('fs');
let rows=window.HOGGY_CONFERENCES.slice();
for(const f of fs.readdirSync('shards')){if(f==='exp-north-america.json')continue;try{const a=JSON.parse(fs.readFileSync('shards/'+f));if(Array.isArray(a))rows.push(...a)}catch(e){}}
const ex=rows.filter(x=>['US','CA'].includes(x.countryCode)).map(x=>({y:(x.start||'').slice(0,4),id:x.id,h:(x.id+'|'+x.name+'|'+x.organiser).toLowerCase()}));
const ids=new Set(rows.map(x=>x.id));
const C={Chicago:['US',41.88,-87.63],Houston:['US',29.76,-95.37],Washington:['US',38.91,-77.04],Orlando:['US',28.54,-81.38],'San Diego':['US',32.72,-117.16],Banff:['CA',51.18,-115.57],Baltimore:['US',39.29,-76.61],Ottawa:['CA',45.42,-75.70],Nashville:['US',36.16,-86.78],Seattle:['US',47.61,-122.33],'Salt Lake City':['US',40.76,-111.89],Denver:['US',39.74,-104.99],'Las Vegas':['US',36.17,-115.14],Atlanta:['US',33.75,-84.39],Boston:['US',42.36,-71.06],Toronto:['CA',43.65,-79.38],Honolulu:['US',21.31,-157.86],'San Francisco':['US',37.77,-122.42],Halifax:['CA',44.65,-63.57],Phoenix:['US',33.45,-112.07],Calgary:['CA',51.05,-114.07],Minneapolis:['US',44.98,-93.27],Vancouver:['CA',49.28,-123.12],'New Orleans':['US',29.95,-90.07],Anaheim:['US',33.84,-117.91],'Quebec City':['CA',46.81,-71.21],Philadelphia:['US',39.95,-75.17],Montreal:['CA',45.50,-73.57],Austin:['US',30.27,-97.74],'San Antonio':['US',29.42,-98.49],Hollywood:['US',26.01,-80.15],Tampa:['US',27.95,-82.46],Miami:['US',25.76,-80.19],Dallas:['US',32.78,-96.80],'Sun Valley':['US',43.70,-114.35],'New York':['US',40.71,-74.01],'Los Angeles':['US',34.05,-118.24],Portland:['US',45.52,-122.68],'Park City':['US',40.65,-111.50],Scottsdale:['US',33.49,-111.93],'West Palm Beach':['US',26.72,-80.05],'Fort Lauderdale':['US',26.12,-80.14],Winnipeg:['CA',49.90,-97.14],Charlotte:['US',35.23,-80.84]};
const CN={US:'United States',CA:'Canada'};
const ST={Chicago:'Illinois'};
const ov={
'asco-annual-meeting':'asco-annual-meeting|asco annual meeting','aan-annual-meeting':'aan-annual|aan annual meeting','aanp-national-conference':'aanp-national|aanp national','aanp-health-policy-conference':'aanp-health-policy|aanp health policy',
'aanem-annual-meeting':'aanem-annual|aanem annual','sno-annual-meeting':'sno annual|sno-annual','apha-annual-meeting':'american public health association','aafp-fmx':'american academy of family physicians','acs-clinical-congress':'american college of surgeons','acp-internal-medicine-meeting':'american college of physicians','\btct\b-conference':'\btct\b','aao-hnsf-annual-meeting':'academy of otolaryngology','aua-annual-meeting':'american urological association','acog-annual-clinical-scientific-meeting':'american college of obstetricians','ada-scientific-sessions':'american diabetes association','ags-annual-scientific-meeting':'american geriatrics society','aacr-annual-meeting':'american association for cancer research','\bastro\b-annual-meeting':'american society for radiation oncology|\bastro\b','aaaai-annual-meeting':'academy of allergy','shm-converge':'converge','acep-scientific-assembly':'american college of emergency physicians','asa-anesthesiology':'american society of anesthesiologists','pas-meeting':'pediatric academic|pas-meeting','asn-kidney-week':'asn-kidney','asco-gi-symposium':'gastrointestinal cancers symposium','asco-gu-symposium':'genitourinary cancers symposium'};
const lines=['exp-na-list.txt','exp-na-list2.txt'].flatMap(f=>fs.readFileSync('work/'+f,'utf8').split(/\r?\n/)).filter(Boolean);
const out=[],seen=new Set(),dropped=[];
const addDays=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const drop=new Set(['sawc-spring','psych-congress']);
for(let l of lines){
 let [id,name,org,spec,city,md,span,url,rx,yrs,rot]=l.split('|');
 if(/skip|guard/.test(id)||drop.has(id))continue;
 if(id==='ascrs-annual-meeting')id='ascrs-colorectal-annual-meeting';
 if(id==='ascrs-colorectal-annual-meeting'&&seen.has(id))continue;
 if(l.includes('ascrs-colorectal')&&seen.has('ascrs-colorectal-annual-meeting'))continue;
 seen.add(id);
 if(id==='cag-annual-scientific-meeting')url='https://cagacg.ca/';
 const re=new RegExp(ov[id]||rx,'i');
 const c=C[city];if(!c){console.error('no city',city,id);continue}
 for(const y of [2027,2028]){
  const nid=id+'-'+y;
  if(ids.has(nid)){dropped.push(nid+' id');continue}
  if(ex.some(e=>e.y==y&&re.test(e.h))){dropped.push(nid+" rx:"+ex.find(e=>e.y==y&&re.test(e.h)).id);continue}
  let s=`2027-${md.slice(0,2)}-${md.slice(2)}`;if(y===2028)s=addDays(s,364);
  const e=addDays(s,+span-1);
  const blurb=`${name} is the annual meeting of the ${org.replace(/^The /,'')}; ${rot==='1'?'the host city rotates and '+city+' is an estimate':city+' is the usual or expected host city'}. Dates expected; not yet announced.`;
  out.push({id:nid,name:`${name} ${y}`,organiser:org,specialty:spec,city,country:CN[c[0]],countryCode:c[0],region:'North America',lat:c[1],lng:c[2],start:s,end:e,format:'In-person',cpdHours:0,cpdBody:'',priceFrom:0,attendees:0,url,blurb,datesConfirmed:false,sourceUrl:url});
 }
}
const u=new Set(out.map(r=>r.id));if(u.size!==out.length)console.error('dup ids');
fs.writeFileSync('shards/exp-north-america.json',JSON.stringify(out,null,1));
console.log(out.length,'rows; dropped',dropped.length);
console.log(dropped.join(' '));
