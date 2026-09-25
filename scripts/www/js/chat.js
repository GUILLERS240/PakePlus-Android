/*
 * Chat de Lumi.
 * Las conversaciones y mensajes de usuarios autenticados se guardan en Supabase.
 * Nunca se envían a Supabase con user_id="local".
 *
 * CAMBIOS NUEVOS EN ESTE ARCHIVO:
 * - Integración del avatar animado (LumiAvatar) mientras Lumi procesa/responde.
 * - Integración del ánimo diario y celos sutiles (LumiMood) en el prompt.
 * - Interceptación de intención de RECORDATORIOS y LISTAS antes de llamar a la IA.
 * - Límite de tokens diarios del plan Gratis (LumiPlan) antes de enviar.
 * - Modo "Solo escuchar" (LumiModes.listenActive) inyectado en el prompt.
 * - Jerga cubana opcional (ajuste lumi_cuban_slang) inyectada en el prompt.
 * - Temas sensibles protegidos (LumiMemory.sensitiveTopics) inyectados en el prompt.
 * - El feedback "no me gusta" ya NO se reenvía como contexto general en cada
 *   mensaje (solo afectaba a esa respuesta puntual); en su lugar se ofrece
 *   "Regenerar" para esa respuesta concreta (ver regenerate()).
 */
window.LumiChat={
  conversationId:null,messageCount:0,summary:'',autoTimer:null,pendingRule:null,

  async init(){this.mode=LumiModes.current;},

  async restoreLatestConversation(){
    const u=await LumiAuth.user();
    if(!LumiDB.client||!u?.id)return false;
    const r=await LumiDB.q('conversations','select',{
      eq:{user_id:u.id},order:'updated_at',limit:1
    });
    const conv=r.data?.[0];
    if(!conv)return false;
    this.conversationId=conv.id;
    this.messageCount=0;
    this.summary=conv.summary||'';
    document.getElementById('messages').innerHTML='';
    document.getElementById('conversationTitle').textContent=conv.title||'Conversación';
    const mr=await LumiDB.q('messages','select',{
      eq:{conversation_id:conv.id,mode:LumiModes.current},order:'created_at'
    });
    (mr.data||[]).forEach(m=>this.add(m.role,m.content,m.id));
    return true;
  },

  async showModeHistory(){
    if(!this.conversationId||String(this.conversationId).startsWith('local-'))return;
    const r=await LumiDB.q('messages','select',{
      eq:{conversation_id:this.conversationId,mode:LumiModes.current},order:'created_at'
    });
    if(r.error)return;
    document.getElementById('messages').innerHTML='';
    (r.data||[]).forEach(m=>this.add(m.role,m.content,m.id));
    document.getElementById('emptyState').hidden=!!(r.data||[]).length;
  },

  async newConversation(){
    this.messageCount=0;
    this.summary='';
    const u=await LumiAuth.user();
    this.conversationId='local-'+Date.now();

    if(LumiDB.client&&u?.id){
      const projectId=LumiProjects.active&&String(LumiProjects.active).startsWith('local-')?null:LumiProjects.active;
      const payload={user_id:u.id,title:'Nueva conversación',mode:LumiModes.current};
      if(projectId)payload.project_id=projectId;
      const r=await LumiDB.save('conversations',payload);
      if(!r.error&&r.data?.[0])this.conversationId=r.data[0].id;
      else if(r.error)console.warn('No se pudo crear conversación:',r.error);
    }

    document.getElementById('messages').innerHTML='';
    document.getElementById('emptyState').hidden=false;
    document.getElementById('conversationTitle').textContent='Nueva conversación';
  },

  add(role,content,id=null){
    const wrap=document.createElement('article');
    wrap.className='message '+role;
    wrap.dataset.id=id||'';
    wrap.innerHTML=`<div class="bubble">${renderMarkdown(content)}</div>${role==='assistant'?'<div class="message-actions"><button data-action="copy-msg" title="Copiar"><span class="svg-icon" data-icon="copy"></span></button><button data-action="feedback" data-type="like" title="Me gusta"><span class="svg-icon" data-icon="like"></span></button><button data-action="feedback" data-type="dislike" title="No me gusta"><span class="svg-icon" data-icon="dislike"></span></button><button data-action="regenerate" title="Regenerar respuesta" hidden><span class="svg-icon" data-icon="spark"></span></button><button data-action="tts-msg" title="Escuchar respuesta" aria-label="Escuchar respuesta"><span class="svg-icon" data-icon="tts"></span></button></div>':''}`;
    document.getElementById('messages').appendChild(wrap);
    document.getElementById('emptyState').hidden=true;
    document.getElementById('chatView').scrollTop=999999;
    if(window.LumiUI)LumiUI.renderIcons();
    return wrap;
  },

  /* NUEVO: intenta interpretar el mensaje como un recordatorio, una lista o una regla, sin llamar a la IA. */
  async tryFastIntents(text){
    const reminder=LumiReminders.parseIntent(text);
    if(reminder){
      await LumiReminders.create(reminder.content,reminder.remind_at);
      this.add('assistant',LUMI_STRINGS.es.reminder_saved);
      return true;
    }
    const newList=LumiLists.parseCreateIntent(text);
    if(newList){
      await LumiLists.create(newList.name,newList.items);
      this.add('assistant',LUMI_STRINGS.es.list_created);
      return true;
    }
    const addToList=LumiLists.parseAddIntent(text);
    if(addToList){
      await LumiLists.addItem(addToList.listName,addToList.item);
      this.add('assistant',LUMI_STRINGS.es.list_item_added);
      return true;
    }
    if(/^cuando diga (.+?) responde (.+)$/i.test(text)){
      if(LumiModes.current==='learning'){
        this.pendingRule=text;
        this.add('assistant','¿Entendí bien la regla? Si quieres guardarla, responde «sí, guárdala».');
        return true;
      }
      await this.learnRule(text);
      return true;
    }
    return false;
  },

  /* Arma los mensajes de sistema (prompt base + personalidad + contexto) para una petición. */
  async buildSystemMessages(userId,text){
    const memories=await LumiMemory.list(text);
    const rules=LumiDB.client&&userId?await this.getRules(userId):JSON.parse(localStorage.getItem('lumi_rules')||'[]').filter(x=>x.active);
    const sensitive=await LumiMemory.sensitiveTopics();
    const cubanSlang=localStorage.getItem('lumi_cuban_slang')==='1';
    const insulted=LumiMood.wasInsulted(text);
    const jealous=LumiMood.mentionsOtherAI(text);

    const msgs=[
      {role:'system',content:LUMI_PROMPTS.base+'\n'+LUMI_PROMPTS.modes[LumiModes.current]},
      {role:'system',content:LumiMood.getPromptExtra()}
    ];
    if(insulted)msgs.push({role:'system',content:LumiMood.insultExtra()});
    if(jealous)msgs.push({role:'system',content:LumiMood.jealousyExtra()});
    if(cubanSlang)msgs.push({role:'system',content:LUMI_PROMPTS.cubanSlang});
    if(LumiModes.listenActive())msgs.push({role:'system',content:LUMI_PROMPTS.listenMode});
    if(sensitive.length)msgs.push({role:'system',content:'Temas que el usuario prefiere no tocar (no los menciones salvo que él los retome): '+sensitive.join(' | ')});
    msgs.push({role:'system',content:'Contexto recordado: '+memories.map(x=>x.content).join(' | ')});
    msgs.push({role:'system',content:'Reglas aprendidas: '+rules.map(x=>x.rule).join(' | ')});
    msgs.push({role:'system',content:'Resumen: '+this.summary});
    msgs.push({role:'user',content:text});
    return {msgs,insulted,jealous};
  },

  async send(text,fromQueue=false){
    text=text.trim();
    if(!text)return;

    if(!navigator.onLine){
      this.add('user',text);
      await LumiOffline.queue({id:'q-'+Date.now(),type:'message',text});
      this.add('assistant',LUMI_STRINGS.es.offline);
      return;
    }

    const user=await LumiAuth.user();
    if(LumiDB.client&&!user?.id){
      this.add('assistant','Necesito que inicies sesión para continuar.');
      return;
    }

    this.add('user',text);
    const userId=user?.id||null;

    if(LumiDB.client&&userId&&this.conversationId&&!String(this.conversationId).startsWith('local-')){
      const r=await LumiDB.save('messages',{conversation_id:this.conversationId,role:'user',content:text,mode:LumiModes.current});
      if(r.error){
        const retry=window.confirm('Supabase no responde ahora. ¿Quieres reintentar guardar el mensaje?');
        if(retry){
          const again=await LumiDB.save('messages',{conversation_id:this.conversationId,role:'user',content:text,mode:LumiModes.current});
          if(again.error)LumiUI.toast('No se pudo sincronizar con Supabase. Continuaré en este dispositivo.');
        }else{
          LumiUI.toast('Continuaré en este dispositivo hasta que vuelva la conexión.');
        }
      }
    }

    LumiMood.applyTone(text);
    await LumiMemory.maybeDetect(text);

    // En Modo Aprendizaje, la regla queda pendiente hasta que el usuario confirme.
    if(this.pendingRule&&/^(sí|si|sí, guárdala|si, guardala|guárdala|guardala|confirmo|correcto)$/i.test(text)){
      const rule=this.pendingRule;this.pendingRule=null;
      await this.learnRule(rule);this.scheduleAuto();return;
    }
    if(this.pendingRule&&/^(no|cambia|cancelar|cancela)$/i.test(text)){
      this.pendingRule=null;this.add('assistant','Vale, no la guardo.');this.scheduleAuto();return;
    }

    // Recordatorios / listas / reglas: se resuelven sin gastar tokens de IA.
    if(await this.tryFastIntents(text)){this.scheduleAuto();return;}

    // Límite de tokens diarios del plan Gratis.
    if(window.LumiPlan&&LumiPlan.profile&&LumiPlan.isOverLimit()){
      this.add('assistant',LUMI_STRINGS.es.plan_limit_reached);
      return;
    }

    const reply=this.add('assistant','');
    const bubble=reply.querySelector('.bubble');
    // CAMBIO 2: el indicador "escribiendo..." es solo visual (typingIndicator).
    // La burbuja queda vacía hasta que llegue content final; nunca se pinta
    // el system prompt ni el reasoning interno.
    bubble.innerHTML='';
    // FIX typing: se muestra SOLO mientras se espera el primer token
    // (Lumi pensando). En cuanto llega contenido real se oculta y la
    // respuesta aparece en la burbuja palabra por palabra.
    let firstToken=true;
    const hideTyping=()=>{const t=document.getElementById('typingIndicator');if(t)t.hidden=true;};
    const showTyping=()=>{const t=document.getElementById('typingIndicator');if(t)t.hidden=false;};
    showTyping();
    document.getElementById('stopWrap').hidden=false;
    if(window.LumiAvatar)LumiAvatar.show('pensativa');

    let full='';
    let insulted=false,jealous=false;

    try{
      const built=await this.buildSystemMessages(userId,text);
      insulted=built.insulted;jealous=built.jealous;

      full=await window.sendMessageStream(
        built.msgs,
        null,
        {mode:LumiModes.current},
        token=>{
          if(token==='\u0000RESET\u0000'){
            full='';
            bubble.innerHTML='';
            firstToken=true;
            showTyping();
            return;
          }
          // CAMBIO 2: por seguridad, si algún chunk trae <think>/reasoning
          // pegado, se descarta antes de pintar. Solo content final visible.
          const clean=String(token||'').replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'');
          if(!clean)return;
          // FIX typing: al llegar el primer contenido real, Lumi ya está
          // "escribiendo" en la burbuja, así que se apaga la animación.
          if(firstToken){firstToken=false;hideTyping();}
          full+=clean;
          bubble.innerHTML=renderMarkdown(full);
          document.getElementById('chatView').scrollTop=999999;
        }
      );

      // CAMBIO 2: limpieza final por si la respuesta completa trajo
      // razonamiento interno mezclado. Solo se muestra y guarda el content limpio.
      full=String(full||'').replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'').replace(/```(think|reasoning)[\s\S]*?```/gi,'').trim();
      bubble.innerHTML=renderMarkdown(full);

      if(window.LumiAvatar){
        const expr=LumiAvatar.detectExpression(full,{badDay:LumiMood.isBadDay(),insulted,jealous});
        LumiAvatar.setExpression(expr);
      }

      if(LumiDB.client&&userId&&this.conversationId&&!String(this.conversationId).startsWith('local-')){
        const r=await LumiDB.save('messages',{conversation_id:this.conversationId,role:'assistant',content:full,mode:LumiModes.current});
        if(!r.error&&r.data?.[0])reply.dataset.id=r.data[0].id;
        else if(r.error)console.warn('No se pudo guardar respuesta:',r.error);
      }else if(!LumiDB.client){
        await LumiOffline.put('messages',{id:'m-'+Date.now(),conversation_id:this.conversationId,role:'assistant',content:full});
      }

      if(window.LumiPlan)await LumiPlan.addUsage(text+full);
      if(window.LumiPlan&&LumiPlan.isCloseToLimit())LumiUI.toast(LUMI_STRINGS.es.plan_limit_close);

      this.messageCount++;
      if(this.messageCount%LUMI_CONFIG.SUMMARY_EVERY===0)this.summary=await this.makeSummary();
    }catch(e){
      console.error('LumiChat.send:',e);
      if(e.name!=='AbortError')bubble.textContent=LUMI_STRINGS.es.offline_message||'Ando cansada ahora, comprueba si tienes conexión 🔌';
    }finally{
      document.getElementById('typingIndicator').hidden=true;
      document.getElementById('stopWrap').hidden=true;
      if(window.LumiAvatar)LumiAvatar.hide();
      this.scheduleAuto();
    }
  },

  /*
   * NUEVO: regenera SOLO la respuesta indicada (tras un "no me gusta"),
   * evitando repetir el mismo texto. No afecta al comportamiento general de Lumi.
   */
  async regenerate(msgEl){
    const bubble=msgEl.querySelector('.bubble');
    const previous=bubble.innerText;
    const userMsg=msgEl.previousElementSibling;
    const text=userMsg&&userMsg.classList.contains('user')?userMsg.querySelector('.bubble').innerText:'';
    if(!text)return;

    const user=await LumiAuth.user();
    const userId=user?.id||null;
    // FIX typing: igual que en send(), solo visible hasta el primer token.
    let firstToken=true;
    const t0=document.getElementById('typingIndicator');if(t0)t0.hidden=false;
    document.getElementById('stopWrap').hidden=false;
    if(window.LumiAvatar)LumiAvatar.show('pensativa');
    let full='';
    try{
      const built=await this.buildSystemMessages(userId,text);
      built.msgs.push({role:'system',content:'La respuesta anterior no le gustó al usuario, no la repitas ni digas algo muy similar: "'+previous.slice(0,300)+'"'});
      full=await window.sendMessageStream(built.msgs,null,{mode:LumiModes.current},token=>{
        if(token==='\u0000RESET\u0000'){full='';bubble.innerHTML='';firstToken=true;const t=document.getElementById('typingIndicator');if(t)t.hidden=false;return;}
        // CAMBIO 2: igual que en send(): solo content final, sin reasoning.
        const clean=String(token||'').replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'');
        if(!clean)return;
        if(firstToken){firstToken=false;const t=document.getElementById('typingIndicator');if(t)t.hidden=true;}
        full+=clean;bubble.innerHTML=renderMarkdown(full);
      });
      // CAMBIO 2: limpieza final antes de mostrar/guardar.
      full=String(full||'').replace(/<(think|reasoning|thought)[^>]*>[\s\S]*?(<\/\1>|$)/gi,'').replace(/```(think|reasoning)[\s\S]*?```/gi,'').trim();
      bubble.innerHTML=renderMarkdown(full);
      if(LumiDB.client&&userId&&msgEl.dataset.id&&!String(msgEl.dataset.id).startsWith('local-')){
        await LumiDB.update('messages',{content:full},{id:msgEl.dataset.id});
      }
    }catch(e){console.error('LumiChat.regenerate:',e);}
    finally{
      document.getElementById('typingIndicator').hidden=true;
      document.getElementById('stopWrap').hidden=true;
      if(window.LumiAvatar)LumiAvatar.hide();
    }
  },

  async learnRule(rule){
    const u=await LumiAuth.user();
    if(LumiDB.client&&u?.id){
      const r=await LumiDB.save('learning_rules',{user_id:u.id,rule,active:true});
      if(r.error)console.warn('No se pudo guardar regla:',r.error);
    }else{
      const a=JSON.parse(localStorage.getItem('lumi_rules')||'[]');
      a.push({id:Date.now(),rule,active:true});
      localStorage.setItem('lumi_rules',JSON.stringify(a));
    }
    this.add('assistant',LUMI_STRINGS.es.learned);
  },

  async getFeedback(userId){
    if(!LumiDB.client||!userId)return [];
    const r=await LumiDB.q('feedback','select',{eq:{user_id:userId},order:'created_at',limit:5});
    if(r.error){console.warn('Feedback:',r.error);return [];}return r.data||[];
  },

  async getRules(userId){
    const r=await LumiDB.q('learning_rules','select',{eq:{user_id:userId,active:true},order:'created_at'});
    if(r.error){console.warn('Reglas:',r.error);return [];}return r.data||[];
  },

  async makeSummary(){
    const els=[...document.querySelectorAll('.message')].slice(-20).map(x=>x.innerText).join('\n');
    try{
      const r=await window.sendMessage([{role:'system',content:LUMI_PROMPTS.summary},{role:'user',content:els}],null,{mode:LumiModes.current});
      return r;
    }catch(e){return this.summary;}
  },

  scheduleAuto(){
    clearTimeout(this.autoTimer);
    if(LumiModes.current!=='assistant'||localStorage.getItem('lumi_auto_message')==='0'||LumiModes.listenActive())return;
    this.autoTimer=setTimeout(()=>{if(document.hidden||!navigator.onLine)return;this.add('assistant','¿Seguimos con lo último que estábamos hablando? 😊');},LUMI_CONFIG.AUTO_MESSAGE_DELAY);
  }
};
