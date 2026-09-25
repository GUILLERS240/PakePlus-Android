window.LumiModes={
  current:'assistant',
  defs:{assistant:{label:'Asistente',temperature:.7,max_tokens:500},study:{label:'Estudio',temperature:.5,max_tokens:1500},learning:{label:'Aprendizaje',temperature:.6,max_tokens:800}},
  set(m){if(!this.defs[m])return;this.current=m;localStorage.setItem('lumi_mode',m);document.getElementById('modePill').innerHTML=this.defs[m].label+' <span class="chev">⌄</span>';},
  load(){this.set(localStorage.getItem('lumi_mode')||'assistant');},

  /*
   * NUEVO: Modo "Solo escuchar". Mientras está activo (hasta que expire o
   * el usuario lo desactive), Lumi responde solo con 1-3 palabras o un emoji.
   * No es un modo de conversación (assistant/study/learning); es un flag aparte
   * que se puede combinar con cualquiera de los tres modos.
   */
  listenUntil:0,

  listenActive(){return this.listenUntil>Date.now();},

  enableListenMode(ms){
    this.listenUntil=Date.now()+(ms||LUMI_CONFIG.LISTEN_MODE_DEFAULT_MS);
    localStorage.setItem('lumi_listen_until',String(this.listenUntil));
  },

  disableListenMode(){
    this.listenUntil=0;
    localStorage.removeItem('lumi_listen_until');
  },

  loadListenState(){
    const saved=parseInt(localStorage.getItem('lumi_listen_until')||'0',10);
    if(saved>Date.now())this.listenUntil=saved;
  }
};
