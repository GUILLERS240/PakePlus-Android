/*
 * Autenticación de Lumi.
 * Supabase Auth es la fuente de verdad cuando está configurado.
 * El modo local solo se utiliza si Supabase no está configurado.
 *
 * Los errores HTTP de Supabase se conservan para que la interfaz pueda
 * mostrar un mensaje útil (por ejemplo, cuando Supabase responde 429).
 */
window.LumiAuth={
  userData:null,

  async user(){
    if(!LumiDB.client)return JSON.parse(localStorage.getItem('lumi_demo_user')||'null');
    try{
      const r=await LumiDB.client.auth.getUser();
      this.userData=r.data?.user||null;
      return this.userData;
    }catch(e){
      console.error('LumiAuth.user:',e);
      return null;
    }
  },

  makeError(error,fallback){
    const err=new Error(error?.message||fallback);
    err.status=error?.status;
    err.code=error?.code;
    err.name=error?.name||'AuthApiError';
    return err;
  },

  async login(email,password){
    if(!LumiDB.client){
      this.userData={id:'local-'+btoa(email),email};
      localStorage.setItem('lumi_demo_user',JSON.stringify(this.userData));
      return {user:this.userData};
    }
    const r=await LumiDB.client.auth.signInWithPassword({email,password});
    if(r.error)throw this.makeError(r.error,'No se pudo iniciar sesión.');
    this.userData=r.data.user;
    localStorage.removeItem('lumi_demo_user');
    return {user:r.data.user,session:r.data.session};
  },

  async register(email,password){
    if(!LumiDB.client){
      this.userData={id:'local-'+btoa(email),email};
      localStorage.setItem('lumi_demo_user',JSON.stringify(this.userData));
      return {user:this.userData};
    }

    if(!email || !email.includes('@'))throw new Error('Escribe un correo válido.');
    if(password.length<6)throw new Error('La contraseña debe tener al menos 6 caracteres.');

    const r=await LumiDB.client.auth.signUp({
      email:email.trim(),
      password,
      options:{data:{display_name:email.trim().split('@')[0]}}
    });

    if(r.error)throw this.makeError(r.error,'No se pudo crear la cuenta.');

    localStorage.removeItem('lumi_demo_user');
    this.userData=r.data.user||null;
    return {
      user:r.data.user||null,
      session:r.data.session||null,
      needsEmailConfirmation:!!r.data.user && !r.data.session
    };
  },

  async logout(){
    if(LumiDB.client){
      const r=await LumiDB.client.auth.signOut();
      if(r.error)console.warn('LumiAuth.logout:',r.error);
    }
    this.userData=null;
    localStorage.removeItem('lumi_demo_user');
    location.reload();
  },

  async recover(email){
    if(!LumiDB.client)throw Error('Configura Supabase para recuperar por correo.');
    const r=await LumiDB.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(r.error)throw this.makeError(r.error,'No se pudo enviar el correo de recuperación.');
  }
};
