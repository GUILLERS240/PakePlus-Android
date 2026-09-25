/*
 * NUEVO: js/plan.js
 * Monetización: planes Gratis y Pro. El plan Gratis tiene un límite de
 * tokens diarios configurable desde Supabase (profiles.daily_token_limit).
 * No hay anuncios: solo un aviso interno para pasar a Pro al acercarse
 * o llegar al límite. El plan y el consumo se guardan en profiles.
 */
window.LumiPlan={
  profile:null,

  async load(){
    const u=await LumiAuth.user();
    if(!u?.id)return null;
    if(LumiDB.client){
      const r=await LumiDB.q('profiles','select',{eq:{id:u.id},maybeSingle:true});
      if(!r.error&&r.data){
        this.profile=r.data;
        const sr=await LumiDB.q('settings','select',{eq:{user_id:u.id},maybeSingle:true});
        this.profile._dailyTokenLimit=Number(sr.data?.extra?.daily_token_limit)||0;
        await this.resetIfNewDay();
        return this.profile;
      }
      // Si el perfil no existe todavía, se crea con valores por defecto.
      const ins=await LumiDB.save('profiles',{id:u.id,plan:'free',tokens_used_today:0,tokens_reset_at:new Date().toISOString()});
      if(!ins.error&&ins.data?.[0])this.profile=ins.data[0];
      return this.profile;
    }
    this.profile=JSON.parse(localStorage.getItem('lumi_profile_local')||'null')||{plan:'free',tokens_used_today:0,tokens_reset_at:new Date().toISOString()};
    return this.profile;
  },

  async resetIfNewDay(){
    if(!this.profile)return;
    const last=this.profile.tokens_reset_at?new Date(this.profile.tokens_reset_at):null;
    const today=new Date().toISOString().slice(0,10);
    if(!last||last.toISOString().slice(0,10)!==today){
      this.profile.tokens_used_today=0;
      this.profile.tokens_reset_at=new Date().toISOString();
      await this.persist();
    }
  },

  dailyLimit(){
    if(this.profile?.plan==='pro')return 0; // sin límite
    return this.profile?._dailyTokenLimit||LUMI_CONFIG.FREE_PLAN_DAILY_TOKENS;
  },

  /* Estimación simple de tokens (aprox. 4 caracteres por token). */
  estimateTokens(text){return Math.ceil((text||'').length/4);},

  isOverLimit(){
    const limit=this.dailyLimit();
    if(!limit)return false;
    return (this.profile?.tokens_used_today||0)>=limit;
  },

  isCloseToLimit(){
    const limit=this.dailyLimit();
    if(!limit)return false;
    return (this.profile?.tokens_used_today||0)>=limit*0.8;
  },

  async addUsage(text){
    if(!this.profile)return;
    this.profile.tokens_used_today=(this.profile.tokens_used_today||0)+this.estimateTokens(text);
    await this.persist();
  },

  async persist(){
    if(LumiDB.client&&this.profile?.id){
      await LumiDB.update('profiles',{
        tokens_used_today:this.profile.tokens_used_today,
        tokens_reset_at:this.profile.tokens_reset_at
      },{id:this.profile.id});
    }else{
      localStorage.setItem('lumi_profile_local',JSON.stringify(this.profile));
    }
  }
};

window.LumiMonetization=window.LumiPlan;
