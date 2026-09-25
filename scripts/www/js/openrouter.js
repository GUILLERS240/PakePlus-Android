/*
 * OpenRouter: proveedor principal de Lumi.
 * La orquestación de fallback vive en ai-provider.js.
 * Las API keys siguen en config.js durante la fase de pruebas solicitada.
 */
(function(){
  'use strict';
  const C=window.LUMI_CONFIG||{};
  const DEFAULT_MODELS=[
    // CAMBIO 1 (25/09/2026): espejo de LUMI_CONFIG.OPENROUTER_FREE_MODELS verificados.
    'qwen/qwen3.8-27b:free',
    'z-ai/glm-5.2:free',
    'thinkingmachines/inkling-small:free',
    'thinkingmachines/inkling:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'google/gemma-4-31b-it:free',
    'cohere/north-mini-code:free'
  ];

  // CAMBIO 2: limpia razonamiento interno que algunos modelos (p.ej. DeepSeek R1,
  // Nemotron, Inkling) devuelven junto al content. Nunca se muestra al usuario.
  function stripReasoning(text){
    if(typeof text!=='string'||!text)return '';
    let t=text;
    // Bloques <think>...</think> o <reasoning>...</reasoning> (con o sin cierre).
    t=t.replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'');
    t=t.replace(/```(think|reasoning)[\s\S]*?```/gi,'');
    return t.trim();
  }

  function hasKey(){
    const k=C.OPENROUTER_API_KEY||'';
    return !!k && !k.includes('AQUI');
  }

  function headers(){
    return {
      Authorization:'Bearer '+C.OPENROUTER_API_KEY,
      'Content-Type':'application/json',
      ...(C.OPENROUTER_HEADERS||{}),
      'HTTP-Referer':C.OPENROUTER_HEADERS?.['HTTP-Referer']||'https://lumi.app',
      'X-Title':C.OPENROUTER_HEADERS?.['X-Title']||'Lumi'
    };
  }

  async function verifyFreeModels(){
    if(!hasKey())return [];
    const configured=(C.OPENROUTER_FREE_MODELS||DEFAULT_MODELS)
      .filter(id=>/:free$/i.test(id));
    try{
      const r=await fetch(`${C.OPENROUTER_URL}/models`,{headers:headers()});
      if(!r.ok)throw new Error('No se pudo verificar los modelos gratuitos.');
      const data=await r.json();
      const map=new Map((data?.data||[]).map(m=>[m.id,m]));
      const verified=configured.filter(id=>{
        const m=map.get(id);
        if(!m)return false;
        const p=m.pricing||{};
        const prompt=Number(p.prompt);
        const completion=Number(p.completion);
        // OpenRouter can expose zero pricing as "0".
        return id.endsWith(':free') && (prompt===0 || p.prompt==='0') && (completion===0 || p.completion==='0');
      });
      return verified;
    }catch(e){
      // No se bloquea toda la app si la consulta de verificación está temporalmente caída.
      // Se mantiene el orden explícito configurado como fallback de disponibilidad.
      return configured;
    }
  }

  async function request(messages,mode,stream,signal,model){
    const opts={
      assistant:{temperature:.7,max_tokens:220},
      study:{temperature:.5,max_tokens:1500},
      learning:{temperature:.6,max_tokens:800}
    }[mode]||{temperature:.7,max_tokens:220};
    // CAMBIO 1: respeta OPENROUTER_MODEL (principal) y luego DEFAULT/FREE_MODELS.
    const chosen=model||C.OPENROUTER_MODEL||C.OPENROUTER_MODEL_DEFAULT||DEFAULT_MODELS[0];
    const r=await fetch(`${C.OPENROUTER_URL}/chat/completions`,{
      method:'POST',headers:headers(),signal,
      body:JSON.stringify({
        model:chosen,messages,temperature:opts.temperature,max_tokens:opts.max_tokens,
        top_p:1,presence_penalty:.2,frequency_penalty:.2,stream:!!stream,
        // CAMBIO 2: pide al gateway que NO incluya reasoning en el stream;
        // solo queremos delta.content (respuesta final).
        include_reasoning:false,reasoning:{exclude:true}
      })
    });
    if(!r.ok){
      let detail='HTTP '+r.status;
      try{const d=await r.json();detail=d?.error?.message||detail;}catch(_){}
      const err=new Error(detail);err.status=r.status;throw err;
    }
    return r;
  }

  window.LumiOpenRouterProvider={
    hasKey,
    verifyFreeModels,
    request,
    // CAMBIO 2: helper para extraer SOLO content final (no reasoning) de respuesta no-stream.
    extractContent:d=>stripReasoning(d?.choices?.[0]?.message?.content||''),
    modelList:()=>C.OPENROUTER_FREE_MODELS||DEFAULT_MODELS
  };
})();
