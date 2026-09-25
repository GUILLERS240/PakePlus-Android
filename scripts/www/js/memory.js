window.LumiMemory={
  localKey:'lumi_memories',
  getLocal(){return JSON.parse(localStorage.getItem(this.localKey)||'[]');},
  setLocal(a){localStorage.setItem(this.localKey,JSON.stringify(a));},

  async list(topic=''){
    let a=this.getLocal();
    if(LumiDB.client){
      const u=await LumiAuth.user();
      if(u?.id){
        const r=await LumiDB.q('memories','select',{eq:{user_id:u.id},order:'weight'});
        if(!r.error)a=r.data||[];
      }
    }
    return a.filter(x=>!topic||new RegExp(topic.split(/\s+/).slice(0,3).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i').test(x.content)).sort((a,b)=>(b.weight||1)-(a.weight||1)).slice(0,LUMI_CONFIG.MAX_MEMORIES_PER_REQUEST);
  },

  async save(category,content,weight=1,protectedFlag=false){
    const item={category,content,weight,is_protected:protectedFlag,created_at:new Date().toISOString()};
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.save('memories',{...item,user_id:u.id});
      if(!r.error&&r.data?.[0])return r.data[0];
      if(r.error)console.warn('Memoria:',r.error);
    }
    const local={...item,id:'local-'+Date.now()};
    const a=this.getLocal();a.push(local);this.setLocal(a);return local;
  },

  async forget(id,content){
    let a=this.getLocal();a=a.filter(x=>id?x.id!==id:x.content!==content);this.setLocal(a);
    if(LumiDB.client&&id&&!String(id).startsWith('local-')){
      const u=await LumiAuth.user();
      if(u?.id)await LumiDB.remove('memories',{id,user_id:u.id});
    }
  },

  async detect(text){
    const patterns=[[/me llamo\s+([\wÁÉÍÓÚáéíóúÑñ ]{2,40})/i,'perfil'],[/mi cumpleaños es\s+(.+)/i,'cumpleaños'],[/me gusta\s+(.+)/i,'gustos'],[/prefiero\s+(.+)/i,'preferencias'],[/mi frase favorita es\s+(.+)/i,'frase_favorita'],[/siempre digo\s+(.+)/i,'muletilla']];
    for(const [re,cat] of patterns){const m=text.match(re);if(m)return {category:cat,content:m[1].trim(),weight:2};}
    return null;
  },

  /* NUEVO: detecta temas que el usuario pide explícitamente no tocar, y los guarda como protegidos. */
  async detectSensitive(text){
    const m=text.match(/(?:prefiero no hablar|no quiero hablar|no me gusta hablar|no toques el tema)\s+(?:de|sobre)?\s*(.+)/i);
    if(!m)return null;
    return {category:'tema_sensible',content:m[1].trim(),weight:3};
  },

  async maybeDetect(text){
    const sensitive=await this.detectSensitive(text);
    if(sensitive){
      await this.save(sensitive.category,sensitive.content,sensitive.weight,true); // protegido: no se olvida ni se saca a menos que el usuario lo retome
      if(window.LumiUI)LumiUI.toast(LUMI_STRINGS.es.saved);
      return sensitive;
    }
    const hit=await this.detect(text);
    if(hit){await this.save(hit.category,hit.content,hit.weight,false);LumiUI.toast(LUMI_STRINGS.es.saved);}
    return hit;
  },

  /* Devuelve solo los temas sensibles protegidos, para avisar a Lumi que los evite. */
  async sensitiveTopics(){
    const all=LumiDB.client?await this.list():this.getLocal();
    const list=Array.isArray(all)?all:this.getLocal();
    return list.filter(x=>x.category==='tema_sensible'||x.is_protected).map(x=>x.content);
  },

  /*
   * NUEVO: olvida automáticamente recuerdos sin importancia (peso bajo, no
   * protegidos) pasado LUMI_CONFIG.MEMORY_FORGET_DAYS. Se ejecuta al iniciar la app.
   */
  async cleanupOld(){
    const days=LUMI_CONFIG.MEMORY_FORGET_DAYS||60;
    const cutoff=Date.now()-days*86400000;
    const u=await LumiAuth.user();
    let items=[];
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.q('memories','select',{eq:{user_id:u.id}});
      if(!r.error)items=r.data||[];
    }else{
      items=this.getLocal();
    }
    const toForget=items.filter(x=>!x.is_protected&&(x.weight||1)<=1&&new Date(x.created_at).getTime()<cutoff);
    for(const item of toForget)await this.forget(item.id,item.content);
  }
};
