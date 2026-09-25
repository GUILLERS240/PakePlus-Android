/*
 * NUEVO: js/reminders.js
 * Sistema de recordatorios. El usuario dice "recuérdame X a las Y" y Lumi
 * lo guarda en Supabase (tabla reminders, ver SUPABASE_SETUP.md) y avisa con
 * una notificación local cuando llega la hora (revisión cada 30s mientras la
 * app está abierta; la app no funciona en segundo plano, como pide el proyecto).
 */
window.LumiReminders={
  checkTimer:null,

  /* Detecta intención de crear un recordatorio en el texto del usuario. */
  parseIntent(text){
    const m=text.match(/recu[eé]rdame\s+(?:que\s+)?(.+?)\s+a las\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if(!m)return null;
    const content=m[1].trim();
    let hour=parseInt(m[2],10);
    const minutes=m[3]?parseInt(m[3],10):0;
    const ampm=(m[4]||'').toLowerCase().replace(/\./g,'');
    if(ampm==='pm'&&hour<12)hour+=12;
    if(ampm==='am'&&hour===12)hour=0;
    const when=new Date();
    when.setSeconds(0,0);
    when.setHours(hour,minutes,0,0);
    if(when.getTime()<=Date.now())when.setDate(when.getDate()+1); // si ya pasó hoy, para mañana
    return {content,remind_at:when.toISOString()};
  },

  async create(content,remindAtISO){
    const u=await LumiAuth.user();
    const row={content,remind_at:remindAtISO,notified:false};
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.save('reminders',{...row,user_id:u.id});
      if(r.error){console.warn('Recordatorio:',r.error);return null;}
      return r.data?.[0]||null;
    }
    const local=JSON.parse(localStorage.getItem('lumi_reminders')||'[]');
    const item={...row,id:'local-'+Date.now()};
    local.push(item);
    localStorage.setItem('lumi_reminders',JSON.stringify(local));
    return item;
  },

  async pending(){
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.q('reminders','select',{eq:{user_id:u.id,notified:false},order:'remind_at'});
      if(!r.error)return r.data||[];
    }
    return JSON.parse(localStorage.getItem('lumi_reminders')||'[]').filter(x=>!x.notified);
  },

  async markNotified(item){
    if(LumiDB.client&&item.id&&!String(item.id).startsWith('local-')){
      const u=await LumiAuth.user();
      if(u?.id)await LumiDB.update('reminders',{notified:true},{id:item.id,user_id:u.id});
      return;
    }
    const local=JSON.parse(localStorage.getItem('lumi_reminders')||'[]');
    const idx=local.findIndex(x=>x.id===item.id);
    if(idx>-1){local[idx].notified=true;localStorage.setItem('lumi_reminders',JSON.stringify(local));}
  },

  async checkDue(){
    const items=await this.pending();
    const now=Date.now();
    for(const item of items){
      if(new Date(item.remind_at).getTime()<=now){
        LumiNotifications.show(LUMI_STRINGS.es.reminder_fired,item.content);
        if(window.LumiUI)LumiUI.toast('⏰ '+item.content);
        await this.markNotified(item);
      }
    }
  },

  init(){
    this.checkDue();
    clearInterval(this.checkTimer);
    this.checkTimer=setInterval(()=>this.checkDue(),30000);
  }
};
