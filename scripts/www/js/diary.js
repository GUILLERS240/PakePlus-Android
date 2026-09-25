/*
 * NUEVO: js/diary.js
 * Diario privado de Lumi. Al final del día, Lumi escribe automáticamente
 * una entrada resumiendo la conversación con el usuario. Se guarda en
 * Supabase (tabla lumi_diary) y NUNCA se muestra en la interfaz: es privado.
 */
window.LumiDiary={
  storageKey:'lumi_diary_last_date',

  async hasEntryFor(dateStr){
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.q('lumi_diary','select',{eq:{user_id:u.id,date:dateStr},maybeSingle:true});
      return !r.error&&!!r.data;
    }
    return localStorage.getItem(this.storageKey)===dateStr;
  },

  async writeEntry(dateStr,text){
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.save('lumi_diary',{user_id:u.id,date:dateStr,content:text});
      if(r.error)console.warn('Diario:',r.error);
    }
    localStorage.setItem(this.storageKey,dateStr);
  },

  /* Genera la entrada de hoy a partir de los mensajes visibles en el DOM. */
  async maybeWriteToday(){
    const today=new Date().toISOString().slice(0,10);
    if(await this.hasEntryFor(today))return;
    const messages=[...document.querySelectorAll('.message')];
    if(messages.length<2)return; // no hubo conversación real hoy todavía
    const transcript=messages.slice(-30).map(x=>x.innerText).join('\n');
    try{
      const entry=await window.sendMessage(
        [{role:'system',content:LUMI_PROMPTS.diary},{role:'user',content:transcript}],
        null,{mode:'assistant'}
      );
      await this.writeEntry(today,entry);
    }catch(e){/* si falla, se reintentará en el próximo boot/chequeo */}
  },

  /* Revisa cada hora si toca escribir la entrada del día. */
  init(){
    this.maybeWriteToday();
    setInterval(()=>this.maybeWriteToday(),3600000);
  }
};
