/* Supabase browser adapter. Merged here so the final structure contains only js/*.js modules. */
/* Adaptador local mínimo para evitar depender de CDN. Expone window.supabase.createClient
   con Auth REST, PostgREST y Realtime básico. Para producción puedes sustituir este archivo
   por el bundle oficial @supabase/supabase-js sin cambiar la capa js/supabase.js. */
(function(){
  function headers(key,token){return {'apikey':key,'Authorization':'Bearer '+(token||key),'Content-Type':'application/json','Prefer':'return=representation'};}
  function client(url,key){let session=JSON.parse(localStorage.getItem('lumi_supabase_session')||'null');
    const auth={
      async signUp({email,password,options={}}){const r=await fetch(url+'/auth/v1/signup',{method:'POST',headers:headers(key),body:JSON.stringify({email,password,data:options.data||{}})});const d=await r.json();if(d.access_token){session=d;localStorage.setItem('lumi_supabase_session',JSON.stringify(d));}return {data:{user:d.user||d,session:d.access_token?d:null},error:r.ok?null:d};},
      async signInWithPassword({email,password}){const r=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(key),body:JSON.stringify({email,password})});const d=await r.json();if(r.ok){session=d;localStorage.setItem('lumi_supabase_session',JSON.stringify(d));}return {data:{user:d.user,session:d},error:r.ok?null:d};},
      async signOut(){session=null;localStorage.removeItem('lumi_supabase_session');return {error:null};},
      async getSession(){return {data:{session},error:null}},
      async getUser(){if(!session?.access_token)return {data:{user:null},error:null};const r=await fetch(url+'/auth/v1/user',{headers:headers(key,session.access_token)});const d=await r.json();return {data:{user:d},error:r.ok?null:d};},
      async resetPasswordForEmail(email){const r=await fetch(url+'/auth/v1/recover',{method:'POST',headers:headers(key),body:JSON.stringify({email})});return {data:null,error:r.ok?null:await r.json()};},
      onAuthStateChange(cb){cb('INITIAL_SESSION',session);return {data:{subscription:{unsubscribe(){}}}}}
    };
    function from(table){let filters=[];let orderBy=null;let limitN=null;let select='*';let single=false;let operation='select';let payload=null;
      const api={select(s='*'){select=s;return api},eq(k,v){filters.push([k,'eq',v]);return api},in(k,v){filters.push([k,'in','('+v.join(',')+')']);return api},order(k,o={}){orderBy=k+(o.ascending===false?' DESC':' ASC');return api},limit(n){limitN=n;return api},single(){single=true;return api},maybeSingle(){single=true;return api},insert(v){operation='insert';payload=v;return api},update(v){operation='update';payload=v;return api},delete(){operation='delete';return api},async then(resolve,reject){try{let q=filters.map(f=>f[0]+'='+f[1]+'.'+encodeURIComponent(f[2])).join('&');let path=url+'/rest/v1/'+table;if(operation==='select'){let u=path+'?select='+encodeURIComponent(select)+(q?'&'+q:'')+(orderBy?'&order='+encodeURIComponent(orderBy):'')+(limitN?'&limit='+limitN:'');let r=await fetch(u,{headers:headers(key,session?.access_token)});let d=await r.json();if(single)d=d[0]||null;resolve({data:d,error:r.ok?null:d});}else{let u=path+(q?'?'+q:'');let r=await fetch(u,{method:operation==='delete'?'DELETE':operation==='insert'?'POST':'PATCH',headers:headers(key,session?.access_token),body:operation==='delete'?undefined:JSON.stringify(payload)});let d=r.status===204?null:await r.json();resolve({data:d,error:r.ok?null:d});}}catch(e){if(reject)reject(e);else resolve({data:null,error:e});}}};return api;}
    return {auth,from,realtime:{channel(){return {on(){return this},subscribe(cb){if(cb)cb('SUBSCRIBED');return this},unsubscribe(){}}}}};
  }
  window.supabase={createClient:client};
})();


/*
 * Capa de acceso a Supabase.
 * Todas las operaciones sensibles se realizan usando el usuario autenticado.
 * No se debe usar el usuario ficticio "local" para escribir en Supabase.
 */
window.LumiDB={
  client:null,
  initialized:false,

  init(){
    const c=window.LUMI_CONFIG||{};
    if(!window.supabase||!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY||c.SUPABASE_URL.includes('AQUI')||c.SUPABASE_ANON_KEY.includes('AQUI')){
      this.initialized=false;
      return false;
    }
    try{
      this.client=window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
      this.initialized=true;
      return true;
    }catch(e){
      console.error('LumiDB.init:',e);
      this.client=null;
      this.initialized=false;
      return false;
    }
  },

  async session(){
    if(!this.client)return null;
    const r=await this.client.auth.getSession();
    if(r.error)throw r.error;
    return r.data?.session||null;
  },

  async user(){
    if(!this.client)return null;
    const r=await this.client.auth.getUser();
    if(r.error)return null;
    return r.data?.user||null;
  },

  async q(table,method,args={}){
    if(!this.client)return {data:null,error:new Error('Supabase no configurado')};
    let q=this.client.from(table);
    if(method==='select')q=q.select(args.select||'*');
    if(args.eq)Object.entries(args.eq).forEach(([k,v])=>q=q.eq(k,v));
    if(args.order)q=q.order(args.order);
    if(args.limit)q=q.limit(args.limit);
    if(method==='insert')q=q.insert(args.data);
    if(method==='update')q=q.update(args.data);
    if(method==='delete')q=q.delete();
    if(args.single)q=q.single();
    if(args.maybeSingle)q=q.maybeSingle();
    return await q;
  },

  async save(table,data){return this.q(table,'insert',{data});},
  async update(table,data,eq){return this.q(table,'update',{data,eq});},
  async remove(table,eq){return this.q(table,'delete',{eq});}
};
