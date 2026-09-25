/*
 * Seguridad de datos protegidos.
 * Un único código secreto por cuenta. El hash y el contador de intentos viven
 * en la tabla security de Supabase; localStorage solo mantiene un estado de UI
 * temporal y nunca guarda el código en texto plano.
 */
window.LumiSecurity={
  maxFails:5,

  validCode(code){return /^\d{8}$/.test(String(code||''));},

  async hash(code){
    const data=new TextEncoder().encode(String(code));
    const digest=await crypto.subtle.digest('SHA-256',data);
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  },

  async row(){
    const u=await LumiAuth.user();
    if(!LumiDB.client||!u?.id)return null;
    const r=await LumiDB.q('security','select',{eq:{user_id:u.id},maybeSingle:true});
    return r.error?null:r.data;
  },

  async setCode(code,recoveryEmail){
    if(!this.validCode(code))throw new Error('El código debe tener exactamente 8 dígitos.');
    const u=await LumiAuth.user();
    if(!u?.id)throw new Error('Inicia sesión para configurar el código.');
    const h=await this.hash(code);
    const email=recoveryEmail||u.email||null;
    if(LumiDB.client){
      const existing=await this.row();
      const data={user_id:u.id,code_hash:h,recovery_email:email,failed_attempts:0,updated_at:new Date().toISOString()};
      if(existing){
        const r=await LumiDB.update('security',data,{user_id:u.id});
        if(r.error)throw new Error('No se pudo guardar el código.');
      }else{
        const r=await LumiDB.save('security',data);
        if(r.error)throw new Error('No se pudo guardar el código.');
      }
    }
    // Cache local únicamente para poder mostrar la UI de recuperación offline.
    localStorage.setItem('lumi_has_secret','1');
    localStorage.setItem('lumi_code_fails','0');
    return true;
  },

  async verify(code){
    if(!this.validCode(code))return {ok:false,locked:false};
    const row=await this.row();
    if(!row)return {ok:false,locked:false};
    const h=await this.hash(code);
    if(h===row.code_hash){
      await LumiDB.update('security',{failed_attempts:0,updated_at:new Date().toISOString()},{user_id:row.user_id});
      localStorage.setItem('lumi_code_fails','0');
      return {ok:true,locked:false};
    }
    const fails=(Number(row.failed_attempts)||0)+1;
    await LumiDB.update('security',{failed_attempts:fails,updated_at:new Date().toISOString()},{user_id:row.user_id});
    localStorage.setItem('lumi_code_fails',String(fails));
    const locked=fails>=this.maxFails;
    if(locked&&window.LumiUI)LumiUI.toast('Se detectaron 5 intentos fallidos. Puedes solicitar recuperación por correo.');
    return {ok:false,locked};
  },

  async clear(){
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id)await LumiDB.remove('security',{user_id:u.id});
    localStorage.removeItem('lumi_has_secret');
    localStorage.removeItem('lumi_code_fails');
  }
};
