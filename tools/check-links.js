// Usage: node tools/check-links.js data/shards/exp-*.json  -> writes data/work/link-report.json, rewrites shards without dead links.
// Dead = DNS failure, connection refused, 404/410, or 5xx twice. 403/429/timeouts are kept (bot protection is not bypassed, just not counted as dead).
const fs=require('fs');const files=process.argv.slice(2);const report={};let dropped=0,kept=0;
const hosts=new Map();
async function probe(u){
  for(let i=0;i<2;i++){
    try{const r=await fetch(u,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(12000),headers:{'user-agent':'HoggyLinkCheck/1.0 (+conference directory)'}});
      if(r.status===404||r.status===410) return 'dead:'+r.status; if(r.status>=500&&i===1) return 'dead:'+r.status; if(r.status<500) return 'ok:'+r.status;
    }catch(e){const m=String(e.cause&&e.cause.code||e.name);if(/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|CERT|ERR_TLS/.test(m)) return 'dead:'+m; if(i===1) return 'unknown:'+m;}
  }
  return 'unknown';
}
(async()=>{
  const all=files.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')).map(c=>c.url));
  const urls=[...new Set(all)];const res={};let idx=0;
  await Promise.all(Array.from({length:12},async()=>{while(idx<urls.length){const u=urls[idx++];res[u]=await probe(u);}}));
  for(const f of files){const arr=JSON.parse(fs.readFileSync(f,'utf8'));const keep=arr.filter(c=>{const s=res[c.url]||'';if(s.startsWith('dead')){dropped++;report[c.url]=s;return false;}kept++;return true;});fs.writeFileSync(f,JSON.stringify(keep));}
  fs.writeFileSync('data/work/link-report.json',JSON.stringify({dropped,kept,dead:report,status:res},null,1));
  console.log({dropped,kept,uniqueUrls:urls.length});
})();
