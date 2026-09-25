(function(){
  window.addEventListener('DOMContentLoaded',async()=>{
    LumiUI.renderIcons();LumiModes.load();LumiModes.loadListenState();LumiDB.init();await LumiOffline.init();
    const local=JSON.parse(localStorage.getItem('lumi_demo_user')||'null');const u=await LumiAuth.user();
    if(!u&&!local){showAuth();return;} await boot(u||local);
  });
  async function boot(user){
    document.getElementById('sideUser').textContent=user?.user_metadata?.display_name||user?.email?.split('@')[0]||'Tú';
    if(LumiDB.client&&user?.id)await LumiDB.update('profiles',{last_seen:new Date().toISOString()},{id:user.id});
    await LumiProjects.load();
    await LumiChat.init();
    const restored=await LumiChat.restoreLatestConversation();
    if(!restored)await LumiChat.newConversation();
    LumiNotifications.init();
    await loadSettings();
    if(!localStorage.getItem('lumi_onboarding_done'))LumiOnboarding.show();

    // NUEVO: arranque de los módulos añadidos.
    if(window.LumiPlan)await LumiPlan.load();          // plan/tokens diarios
    if(window.LumiReminders)LumiReminders.init();        // recordatorios (chequeo cada 30s)
    if(window.LumiDiary)LumiDiary.init();                 // diario privado de Lumi
    if(window.LumiMemory)LumiMemory.cleanupOld();          // olvida recuerdos sin importancia y viejos
    // Todos los datos del usuario se sincronizan automáticamente desde Supabase
    // al iniciar sesión porque cada módulo (proyectos, listas, recordatorios,
    // memorias, reglas) consulta directamente a LumiDB en su propio load()/init().
  }
  function showAuth(){
    const root=document.getElementById('authRoot');
    if(!root)return;
    root.classList.add('auth-root');
    root.innerHTML=document.getElementById('tpl-auth').content.cloneNode(true).firstElementChild.outerHTML;
    root.hidden=false;

    const form=root.querySelector('#authForm');
    const email=root.querySelector('#authEmail');
    const password=root.querySelector('#authPassword');
    const submit=root.querySelector('#authSubmit');
    const error=root.querySelector('#authError');
    form.dataset.mode='login';

    root.querySelectorAll('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const register=b.dataset.authTab==='register';
      submit.textContent=register?'Crear cuenta':'Entrar';
      form.dataset.mode=register?'register':'login';
      password.autocomplete=register?'new-password':'current-password';
      error.textContent='';
      setTimeout(()=>email.focus(),0);
    }));

    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const emailValue=email.value.trim();
      const passwordValue=password.value;
      error.textContent='';
      submit.disabled=true;
      submit.textContent=form.dataset.mode==='register'?'Creando cuenta...':'Entrando...';
      try{
        let result;
        if(form.dataset.mode==='register') result=await LumiAuth.register(emailValue,passwordValue);
        else result=await LumiAuth.login(emailValue,passwordValue);
        const loggedUser=result?.user||await LumiAuth.user();
        if(!loggedUser){
          error.textContent='Cuenta creada. Revisa tu correo para confirmar la cuenta y luego entra.';
          submit.disabled=false;
          submit.textContent='Entrar';
          return;
        }
        root.hidden=true;
        root.innerHTML='';
        root.classList.remove('auth-root');
        await boot(loggedUser);
      }catch(err){
        let message=err?.message||'No se pudo completar la operación.';

        // Supabase puede responder 429 cuando se supera el límite de Auth.
        // No reintentamos automáticamente porque eso empeora el rate limit.
        if(err?.status===429 || err?.code==='over_request_rate_limit' || err?.code==='over_email_send_rate_limit'){
          message=err?.code==='over_email_send_rate_limit'
            ? 'Supabase ha limitado temporalmente los correos de registro. Espera un poco antes de volver a intentarlo.'
            : 'Se hicieron demasiados intentos de registro. Espera unos minutos y vuelve a intentarlo.';
        }else if(err?.code==='user_already_exists'){
          message='Ese correo ya tiene una cuenta. Pulsa «Entrar» para iniciar sesión.';
        }else if(err?.code==='email_address_invalid'){
          message='Ese correo no es válido. Prueba con otro correo.';
        }else if(err?.code==='signup_disabled'){
          message='El registro de cuentas está desactivado en Supabase.';
        }else if(err?.code==='email_address_not_authorized'){
          message='Supabase no permite enviar el correo de confirmación a esa dirección con el correo predeterminado. Configura SMTP propio o usa un correo autorizado para pruebas.';
        }

        error.textContent=message;
        submit.disabled=false;
        submit.textContent=form.dataset.mode==='register'?'Crear cuenta':'Entrar';
      }
    });
  }
  async function loadSettings(){
    const u=await LumiAuth.user();
    let p=null;
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.q('profiles','select',{eq:{id:u.id},maybeSingle:true});
      if(!r.error)p=r.data;
    }
    document.getElementById('setUsername')&&(document.getElementById('setUsername').value=p?.username||p?.display_name||localStorage.getItem('lumi_username')||'');
    document.getElementById('setLumiName')&&(document.getElementById('setLumiName').value=p?.lumi_name||localStorage.getItem('lumi_name')||'Lumi');
    document.documentElement.lang=p?.language||localStorage.getItem('lumi_language')||'es';
    localStorage.setItem('lumi_username',document.getElementById('setUsername')?.value||'');
    localStorage.setItem('lumi_name',document.getElementById('setLumiName')?.value||'Lumi');
    if(p?.cuban_slang!==undefined)localStorage.setItem('lumi_cuban_slang',p.cuban_slang?'1':'0');
    if(p?.lumi_auto_message!==undefined)localStorage.setItem('lumi_auto_message',p.lumi_auto_message?'1':'0');
  }
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-action], [data-mode], [data-project]');if(!b)return;const a=b.dataset.action;
    if(b.dataset.mode){
      LumiModes.set(b.dataset.mode);
      if(LumiDB.client&&LumiChat.conversationId&&!String(LumiChat.conversationId).startsWith('local-'))await LumiDB.update('conversations',{mode:b.dataset.mode},{id:LumiChat.conversationId});
      LumiUI.closeModal();
      await LumiChat.showModeHistory();
      return;
    }
    if(b.dataset.project){LumiProjects.active=b.dataset.project;LumiProjects.render();return;}
    if(a==='open-sidebar')LumiUI.openSidebar();if(a==='close-sidebar')LumiUI.closeSidebar();
    if(a==='open-settings'){
      const r=LumiUI.modal('tpl-settings');
      r.querySelector('#setAutoMessage').checked=localStorage.getItem('lumi_auto_message')!=='0';
      r.querySelector('#setNotifications').checked=localStorage.getItem('lumi_notifications')==='1';
      // NUEVO: ajustes añadidos (jerga cubana, modo solo escuchar, info de plan).
      const cs=r.querySelector('#setCubanSlang');if(cs)cs.checked=localStorage.getItem('lumi_cuban_slang')==='1';
      const lm=r.querySelector('#setListenMode');if(lm)lm.checked=LumiModes.listenActive();
      const planLabel=r.querySelector('#setPlanLabel');
      if(planLabel&&window.LumiPlan)planLabel.textContent=(LumiPlan.profile?.plan==='pro')?'Pro':'Gratis';
    }
    if(a==='close-modal')LumiUI.closeModal();
    if(a==='new-chat'){LumiUI.closeSidebar();await LumiChat.newConversation();}
    if(a==='change-mode')LumiUI.modal('tpl-mode');
    if(a==='new-project')LumiUI.modal('tpl-project');
    if(a==='logout')await LumiAuth.logout();
    if(a==='show-tutorial'){LumiUI.closeModal();LumiOnboarding.show();}
    if(a==='skip-onboarding')LumiOnboarding.done();if(a==='next-onboarding')LumiOnboarding.next();if(a==='stop')LumiOpenRouter.stop();if(a==='future-attach')LumiUI.toast('Adjuntar archivos quedará habilitado en una fase posterior.');
    if(a==='quick'){messageInput.value=b.dataset.text;messageInput.focus();}
    if(a==='copy-msg'){const txt=b.closest('.message').querySelector('.bubble').innerText;navigator.clipboard?.writeText(txt);LumiUI.toast('Copiado');}
    if(a==='tts-msg'){const txt=b.closest('.message')?.querySelector('.bubble')?.innerText||'';window.LumiTTS?.speak(txt,document.documentElement.lang==='en'?'en-US':'es-ES');}
    if(a==='feedback'){
      const msg=b.closest('.message'),type=b.dataset.type;
      const u=await LumiAuth.user();
      if(LumiDB.client&&u&&!String(msg.dataset.id).startsWith('local-'))await LumiDB.save('feedback',{user_id:u.id,message_id:msg.dataset.id,type,used_for_learning:false});
      LumiUI.toast(type==='like'?'Gracias 💛':'Gracias, lo tendré en cuenta.');
      // NUEVO: tras un "no me gusta" se habilita el botón de regenerar SOLO para esa respuesta.
      if(type==='dislike'){const regen=msg.querySelector('[data-action="regenerate"]');if(regen)regen.hidden=false;}
    }
    if(a==='regenerate'){const msg=b.closest('.message');await LumiChat.regenerate(msg);} // NUEVO
    if(a==='set-secret')LumiUI.modal('tpl-secret');
    if(a==='save-secret'){try{await LumiSecurity.setCode(document.getElementById('secretInput').value);LumiUI.toast('Código guardado');LumiUI.closeModal();}catch(err){LumiUI.toast(err.message);}}
    if(a==='recover-secret')LumiUI.modal('tpl-recovery');
    if(a==='recover-account'){const email=prompt('Escribe tu correo');if(email)try{await LumiAuth.recover(email);LumiUI.toast('Te envié un correo de recuperación.');}catch(err){LumiUI.toast(err.message);}}
    if(a==='send-recovery'){
      const email=document.getElementById('recoveryEmail')?.value.trim();
      if(!email){LumiUI.toast('Escribe tu correo de recuperación.');return;}
      try{
        await LumiAuth.recover(email);
        LumiUI.toast('Te envié un correo de recuperación. Revisa tu bandeja.');
      }catch(err){LumiUI.toast(err.message||'No se pudo enviar el correo.');}
    }
    if(a==='apply-recovery'){const c=document.getElementById('recoveryCode').value;try{await LumiSecurity.setCode(c);LumiUI.toast('Código actualizado');LumiUI.closeModal();}catch(err){LumiUI.toast(err.message);}}
    if(a==='create-project'){const n=document.getElementById('projectName').value.trim();if(n){await LumiProjects.create(n);LumiUI.closeModal();}}
    if(a==='show-memory'){const m=await LumiMemory.list();LumiUI.toast(m.length?m.map(x=>x.content).join(' • '):'Todavía no tengo recuerdos guardados.');}
    // NUEVO: ver listas del usuario (sistema de LISTAS).
    if(a==='show-lists'){
      const lists=await LumiLists.load();
      LumiUI.toast(lists.length?lists.map(l=>l.name+': '+(l.items||[]).map(i=>i.text).join(', ')).join(' | '):'Todavía no tienes listas. Dime «crea una lista de compras: leche, pan».');
    }
    // NUEVO: activar/desactivar el modo "solo escuchar" manualmente desde ajustes.
    if(a==='toggle-listen-mode'){
      if(LumiModes.listenActive()){LumiModes.disableListenMode();LumiUI.toast(LUMI_STRINGS.es.listen_mode_off);}
      else{LumiModes.enableListenMode();LumiUI.toast(LUMI_STRINGS.es.listen_mode_on);}
    }
    if(a==='reset-learning'){ // NUEVO: opción en ajustes para resetear el aprendizaje de Lumi.
      if(confirm('¿Reiniciar todo lo que Lumi ha aprendido de ti (reglas aprendidas)?')){
        const u=await LumiAuth.user();
        localStorage.removeItem('lumi_rules');
        if(LumiDB.client&&u)await LumiDB.remove('learning_rules',{user_id:u.id});
        LumiUI.toast('Aprendizaje reiniciado.');
      }
    }
    if(a==='save-profile'){
      const username=document.getElementById('setUsername').value.trim();
      const lumiName=document.getElementById('setLumiName').value.trim()||'Lumi';
      const auto=document.getElementById('setAutoMessage').checked;
      const cs=document.getElementById('setCubanSlang');const cuban=!!cs?.checked;
      const listen=document.getElementById('setListenMode')?.checked;
      const lang=document.getElementById('setLanguage')?.value||'es';
      localStorage.setItem('lumi_username',username);
      localStorage.setItem('lumi_name',lumiName);
      localStorage.setItem('lumi_auto_message',auto?'1':'0');
      localStorage.setItem('lumi_cuban_slang',cuban?'1':'0');
      document.documentElement.lang=lang;
      if(listen&&!LumiModes.listenActive())LumiModes.enableListenMode();
      if(!listen)LumiModes.disableListenMode();
      const u=await LumiAuth.user();
      if(LumiDB.client&&u?.id){
        await LumiDB.update('profiles',{
          username,display_name:username,lumi_name:lumiName,language:lang,
          lumi_auto_message:auto,cuban_slang:cuban,listen_mode:!!listen,
          updated_at:new Date().toISOString()
        },{id:u.id});
        await LumiDB.update('settings',{notifications_enabled:document.getElementById('setNotifications').checked},{user_id:u.id});
      }
      if(document.getElementById('setNotifications').checked)await LumiNotifications.enable();
      LumiUI.toast('Ajustes guardados');
    }
    if(a==='delete-account'){
      // NUEVO: si hay código secreto configurado, se exige verificarlo antes de borrar la cuenta
      // (protección de acceso a datos sensibles).
      const securityRow=await LumiSecurity.row();
      if(securityRow?.code_hash){
        const code=prompt('Escribe tu código secreto de 8 dígitos para continuar');
        if(code===null)return;
        const res=await LumiSecurity.verify(code);
        if(!res.ok){LumiUI.toast(res.locked?LUMI_STRINGS.es.secret_locked:'Código incorrecto.');return;}
      }
      if(confirm('¿Eliminar la cuenta y sus datos? Esta acción no se puede deshacer.')){
        const u=await LumiAuth.user();
        if(LumiDB.client&&u){
          for(const t of ['feedback','conversations','projects','memories','learning_rules','security','notifications','settings','reminders','lists'])
            await LumiDB.remove(t,{user_id:u.id});
          await LumiDB.remove('profiles',{id:u.id});
        }
        await LumiAuth.logout();
      }
    }
  });
  document.getElementById('composer').addEventListener('submit',e=>{e.preventDefault();const v=document.getElementById('messageInput').value;document.getElementById('messageInput').value='';LumiChat.send(v);});
  document.getElementById('messageInput').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,160)+'px';clearTimeout(LumiChat.autoTimer);});

  if(window.visualViewport){
    const keepComposerVisible=()=>{
      const input=document.getElementById('messageInput');
      if(document.activeElement===input)setTimeout(()=>input.scrollIntoView({block:'nearest'}),60);
    };
    visualViewport.addEventListener('resize',keepComposerVisible);
    visualViewport.addEventListener('scroll',keepComposerVisible);
  }

})();
