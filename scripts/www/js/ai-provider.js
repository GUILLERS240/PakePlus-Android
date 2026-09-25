/*
 * Orquestador de IA de Lumi.
 * OpenRouter -> varios modelos :free verificados -> PlataformIA/radiance.
 * Si ambos proveedores fallan se muestra un mensaje amigable.
 *
 * Comentario para Cline:
 * - No se fija un timeout artificial en fetch de OpenRouter.
 * - AbortController permite cancelar desde "Detener".
 * - Si un stream se corta después de emitir texto, se reinicia el buffer de UI
 *   antes del reintento para evitar respuestas duplicadas.
 */
(function(){
  'use strict';
  const C=window.LUMI_CONFIG||{};
  const FRIENDLY='Ando cansada ahora, comprueba si tienes conexión 🔌';

  const options={
    assistant:{temperature:.7,max_tokens:220},
    study:{temperature:.5,max_tokens:1500},
    learning:{temperature:.6,max_tokens:800}
  };

  let currentController=null;
  let verifiedCache=null;
  let verifiedAt=0;

  async function verifiedModels(){
    if(verifiedCache&&Date.now()-verifiedAt<10*60*1000)return verifiedCache;
    verifiedCache=await window.LumiOpenRouterProvider.verifyFreeModels();
    verifiedAt=Date.now();
    return verifiedCache;
  }

  function emit(onChunk,value){
    if(typeof onChunk==='function')onChunk(value);
  }

  async function parseStream(response,onChunk){
    if(!response.body)throw new Error('Streaming no disponible.');
    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer='',full='',doneMarker=false;

    const consumeLine=raw=>{
      const line=raw.trim();
      if(!line.startsWith('data:'))return;
      const data=line.slice(5).trim();
      if(!data)return;
      if(data==='[DONE]'){doneMarker=true;return;}
      let json;
      try{json=JSON.parse(data);}catch(_){return;}
      // CAMBIO 2: SOLO delta.content es respuesta final. Se ignoran
      // delta.reasoning / delta.reasoning_content / delta.thinking (DeepSeek R1,
      // Nemotron, etc.) y cualquier otro campo que no sea content.
      const delta=json?.choices?.[0]?.delta||{};
      const rawText=typeof delta.content==='string'?delta.content:'';
      // CAMBIO 2: si el content trae bloques <think> pegados, se limpian.
      const text=rawText.replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'');
      if(text){full+=text;emit(onChunk,text);}
    };

    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split(/\r?\n/);
      buffer=lines.pop()||'';
      for(const line of lines)consumeLine(line);
    }

    if(buffer.trim())consumeLine(buffer);
    if(!doneMarker && full) {
      // Algunos gateways cierran el socket sin mandar [DONE]. El cierre
      // correcto del body también es un fin de stream válido.
    }
    if(!full)throw new Error('El proveedor terminó el stream sin contenido.');
    return full;
  }

  async function callProvider(name,messages,mode,signal,onChunk){
    const stream=true;
    const tries=name==='openrouter'
      ?await verifiedModels()
      :[C.PLATAFORMIA_MODEL_DEFAULT||'radiance'];

    if(name==='openrouter'&&!tries.length)return null;

    for(let i=0;i<tries.length;i++){
      const model=tries[i];
      for(let attempt=1;attempt<=2;attempt++){
        try{
          let response;
          if(name==='openrouter'){
            // request() usa el modelo explícito que fue verificado.
            response=await window.LumiOpenRouterProvider.request(messages,mode,stream,signal,model);
          }else{
            response=await window.LumiPlataformIAProvider.request(messages,mode,stream,signal);
          }
          return await parseStream(response,onChunk);
        }catch(error){
          if(error?.name==='AbortError')throw error;
          // Una respuesta parcial no debe mezclarse con el siguiente intento.
          emit(onChunk,'\u0000RESET\u0000');
          if(attempt<2)await new Promise(r=>setTimeout(r,500));
        }
      }
    }
    return null;
  }

  async function orchestrate(messages,mode,onChunk,signal){
    const order=Array.isArray(C.AI_PROVIDER_ORDER)&&C.AI_PROVIDER_ORDER.length
      ?C.AI_PROVIDER_ORDER:['openrouter','plataformia'];

    for(const provider of order){
      if(provider==='openrouter'&&!window.LumiOpenRouterProvider.hasKey())continue;
      if(provider==='plataformia'&&!window.LumiPlataformIAProvider.hasKey())continue;
      const result=await callProvider(provider,messages,mode,signal,onChunk);
      if(result)return result;
    }
    emit(onChunk,FRIENDLY);
    return FRIENDLY;
  }

  async function sendMessageStream(messages,model,opts,onChunk){
    const o=opts||{};
    const mode=o.mode||window.LumiModes?.current||'assistant';
    return orchestrate(messages,mode,onChunk,o.signal);
  }

  async function sendMessage(messages,model,opts){
    // No streaming for internal tasks (memory, summary, diary).
    const o=opts||{};
    const mode=o.mode||window.LumiModes?.current||'assistant';
    const controller=o.signal?null:new AbortController();
    const signal=o.signal||controller.signal;
    const order=Array.isArray(C.AI_PROVIDER_ORDER)&&C.AI_PROVIDER_ORDER.length?C.AI_PROVIDER_ORDER:['openrouter','plataformia'];

    async function one(provider){
      if(provider==='openrouter'){
        if(!window.LumiOpenRouterProvider.hasKey())return null;
        const models=await verifiedModels();
        for(const m of models){
          try{
            const r=await window.LumiOpenRouterProvider.request(messages,mode,false,signal,m);
            // CAMBIO 2: respuesta no-stream: leer SOLO message.content, nunca
            // message.reasoning / reasoning_content, y limpiar bloques <think>.
            const d=await r.json();
            let text=d?.choices?.[0]?.message?.content||'';
            text=typeof window.LumiOpenRouterProvider.extractContent==='function'
              ?window.LumiOpenRouterProvider.extractContent(d):String(text||'');
            if(text)return text;
          }catch(e){if(e?.name==='AbortError')throw e;}
        }
      }
      if(provider==='plataformia'){
        if(!window.LumiPlataformIAProvider.hasKey())return null;
        try{
          const r=await window.LumiPlataformIAProvider.request(messages,mode,false,signal);
          // CAMBIO 2: igual que arriba, solo content final.
          const d=await r.json();let text=d?.choices?.[0]?.message?.content||'';
          if(typeof text==='string')text=text.replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'').trim();
          return text||null;
        }catch(e){if(e?.name==='AbortError')throw e;}
      }
      return null;
    }
    for(const provider of order){const r=await one(provider);if(r)return r;}
    return FRIENDLY;
  }

  function createController(){
    currentController=new AbortController();
    return currentController;
  }
  function stop(){
    if(currentController){currentController.abort();currentController=null;}
  }

  window.sendMessage=sendMessage;
  window.sendMessageStream=sendMessageStream;
  window.LumiOpenRouter={
    sendMessage,sendMessageStream,createController,stop,
    stream:async(messages,mode,onToken)=>{
      const controller=createController();
      try{return await sendMessageStream(messages,null,{mode,signal:controller.signal},onToken);}
      finally{if(currentController===controller)currentController=null;}
    }
  };
})();
