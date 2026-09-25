/*
 * NUEVO: js/lists.js
 * Sistema de listas (tareas, compras, etc.) guardadas en Supabase (tabla
 * lists, items en JSONB) y sincronizadas entre dispositivos. El usuario
 * puede crear listas y añadir ítems por lenguaje natural desde el chat.
 */
window.LumiLists={
  /* "crea una lista de compras: leche, pan, huevos" */
  parseCreateIntent(text){
    const m=text.match(/crea(?:me)?\s+una\s+lista\s+(?:de\s+)?([\wÁÉÍÓÚáéíóúÑñ ]{2,40}?)\s*:\s*(.+)/i);
    if(!m)return null;
    const name=m[1].trim();
    const items=m[2].split(/,|\by\b/i).map(s=>s.trim()).filter(Boolean).map(t=>({text:t,done:false}));
    return {name,items};
  },

  /* "añade X a mi lista de compras" */
  parseAddIntent(text){
    const m=text.match(/a[ñn]ade\s+(.+?)\s+a\s+(?:mi\s+)?lista\s+(?:de\s+)?([\wÁÉÍÓÚáéíóúÑñ ]{2,40})/i);
    if(!m)return null;
    return {item:m[1].trim(),listName:m[2].trim()};
  },

  async load(){
    const u=await LumiAuth.user();
    if(!u?.id)return [];
    if(LumiDB.client){
      const r=await LumiDB.q('lists','select',{eq:{user_id:u.id},order:'updated_at'});
      if(!r.error)return r.data||[];
    }
    return JSON.parse(localStorage.getItem('lumi_lists')||'[]');
  },

  async saveLocal(list){
    const all=JSON.parse(localStorage.getItem('lumi_lists')||'[]');
    const idx=all.findIndex(x=>x.id===list.id);
    if(idx>-1)all[idx]=list;else all.push(list);
    localStorage.setItem('lumi_lists',JSON.stringify(all));
  },

  async create(name,items){
    const u=await LumiAuth.user();
    if(!u?.id)return null;
    if(LumiDB.client){
      const r=await LumiDB.save('lists',{user_id:u.id,name,items});
      if(r.error){console.warn('Lista:',r.error);return null;}
      return r.data?.[0]||null;
    }
    const local={id:'local-'+Date.now(),user_id:u.id,name,items,updated_at:new Date().toISOString()};
    await this.saveLocal(local);
    return local;
  },

  async addItem(listName,itemText){
    const lists=await this.load();
    let list=lists.find(l=>l.name.toLowerCase()===listName.toLowerCase());
    if(!list)return this.create(listName,[{text:itemText,done:false}]);
    const items=[...(list.items||[]),{text:itemText,done:false}];
    if(LumiDB.client&&!String(list.id).startsWith('local-')){
      const u=await LumiAuth.user();
      await LumiDB.update('lists',{items,updated_at:new Date().toISOString()},{id:list.id,user_id:u.id});
    }else{
      list.items=items;
      await this.saveLocal(list);
    }
    return list;
  }
};
