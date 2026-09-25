/*
 * TTS opcional. Usa Web Speech API del dispositivo; no guarda audio ni datos.
 */
window.LumiTTS={
  enabled:true,
  speak(text,lang){
    if(!this.enabled||!('speechSynthesis' in window)||!text)return false;
    try{
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(String(text).replace(/\s+/g,' ').trim());
      u.lang=lang||document.documentElement.lang||'es-ES';
      u.rate=.98;u.pitch=1.05;
      window.speechSynthesis.speak(u);
      return true;
    }catch(_){return false;}
  },
  stop(){try{window.speechSynthesis?.cancel();}catch(_){}}
};
