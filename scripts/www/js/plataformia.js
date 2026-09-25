/*
 * PlataformIA: proveedor de respaldo.
 * API compatible con OpenAI en /v1/chat/completions.
 */
(function(){
  'use strict';
  const C=window.LUMI_CONFIG||{};
  function hasKey(){const k=C.PLATAFORMIA_API_KEY||'';return !!k&&!k.includes('AQUI');}
  function headers(){return {'Authorization':'Bearer '+C.PLATAFORMIA_API_KEY,'Content-Type':'application/json'};}
  function modelFor(mode){
    const m=C.PLATAFORMIA_MODELS||{};
    if(mode==='study'||mode==='learning')return m.complex||C.PLATAFORMIA_MODEL_DEFAULT||'radiance';
    return m.daily||C.PLATAFORMIA_MODEL_DEFAULT||'radiance';
  }
  async function request(messages,mode,stream,signal){
    const opts={assistant:{temperature:.7,max_tokens:220},study:{temperature:.5,max_tokens:1500},learning:{temperature:.6,max_tokens:800}}[mode]||{temperature:.7,max_tokens:220};
    const r=await fetch(`${C.PLATAFORMIA_URL}${C.PLATAFORMIA_ENDPOINT}`,{
      method:'POST',headers:headers(),signal,
      // CAMBIO 2: no se cambia la conexión; solo se documenta que la respuesta
      // leída por ai-provider.js usa ÚNICAMENTE message.content (nunca reasoning).
      body:JSON.stringify({model:modelFor(mode),messages,temperature:opts.temperature,max_tokens:opts.max_tokens,stream})
    });
    if(!r.ok){
      let detail='HTTP '+r.status;
      try{const d=await r.json();detail=d?.error?.message||detail;}catch(_){}
      const err=new Error(detail);err.status=r.status;throw err;
    }
    return r;
  }
  window.LumiPlataformIAProvider={hasKey,request,modelFor};
})();
