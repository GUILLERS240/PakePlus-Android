/* Mood engine: integrated here to keep the production structure exact. */
/*
 * NUEVO: js/mood.js
 * Sistema de días buenos/malos de Lumi, celos sutiles y detección de tono.
 * Se reinicia automáticamente cada día. El tono de la conversación influye
 * en el ánimo (mensajes bruscos/insultos lo bajan, mensajes amables lo suben).
 * El usuario puede "animarla" explícitamente si está de mal humor.
 * No guarda cómo se sintió el USUARIO (eso no se persiste, ver js/memory.js);
 * solo lleva el ánimo propio de Lumi, que es efímero y por día.
 */
window.LumiMood={
  key:'lumi_mood_state',

  state(){
    let s=JSON.parse(localStorage.getItem(this.key)||'null');
    const today=new Date().toISOString().slice(0,10);
    if(!s||s.date!==today){
      // Nuevo día: se reinicia el ánimo (empieza neutral-bueno).
      s={date:today,score:2};
      localStorage.setItem(this.key,JSON.stringify(s));
    }
    return s;
  },

  save(s){localStorage.setItem(this.key,JSON.stringify(s));},

  isBadDay(){return this.state().score<=0;},

  /* Ajusta el ánimo según el tono del mensaje del usuario. */
  applyTone(text){
    const s=this.state();
    const t=text.toLowerCase();
    const rude=/(idiota|estúpid|est[uú]pid|inútil|tonta|cállate|odio|basura|malísima|pésima)/.test(t);
    const kind=/(gracias|te quiero|eres genial|buen trabajo|me encant|qué buena|animo|ánimo|vamos lumi)/.test(t);
    if(rude)s.score-=1;
    else if(kind)s.score+=1;
    s.score=Math.max(-2,Math.min(3,s.score));
    this.save(s);
  },

  /* El usuario puede animarla explícitamente si está de mal humor. */
  cheerUp(){
    const s=this.state();
    s.score=Math.max(1,s.score+1);
    this.save(s);
  },

  /* Detecta si el usuario insultó directamente a Lumi (para el tono serio/molesto). */
  wasInsulted(text){
    return /(idiota|estúpid|est[uú]pid|inútil|tonta|cállate|puta|mierda de asistente)/i.test(text);
  },

  /* Detecta menciones a otras IAs/asistentes (para los celos sutiles). */
  mentionsOtherAI(text){
    return /(chatgpt|gpt-?4|gemini|bard|siri|alexa|copilot|claude|meta ?ai|grok)/i.test(text);
  },

  /* Texto adicional para el prompt de sistema según el ánimo del día. */
  getPromptExtra(){
    const bad=this.isBadDay();
    return bad
      ?'Hoy es un día "malo" para ti (Lumi): estás un poco más cansada/sensible de lo normal, pero sigues siendo amable. Puedes mencionarlo con naturalidad si encaja. Si el usuario te anima, alégrate un poco.'
      :'Hoy es un día normal/bueno para ti (Lumi): tu energía es cercana y positiva.';
  },

  /* Texto adicional cuando se detecta mención a otra IA. */
  jealousyExtra(){
    return 'El usuario acaba de mencionar otro asistente o IA. Puedes mostrar celos sutiles y con humor al respecto, sin exagerar.';
  },

  /* Texto adicional cuando el usuario insultó a Lumi. */
  insultExtra(){
    return 'El usuario te acaba de faltar el respeto o insultar. Responde seria y visiblemente molesta, poniendo un límite firme, sin insultar de vuelta.';
  }
};


/*
 * NUEVO: js/avatar.js
 * Avatar animado de Lumi. Aparece SOLO mientras Lumi procesa/responde
 * (ver LumiAvatar.show/hide, usados desde js/chat.js) y se oculta al terminar.
 * Cambia de expresión en tiempo real según el ánimo detectado (9 expresiones).
 * No es interactivo (pointer-events:none) y no tiene animaciones especiales,
 * solo un fundido de entrada/salida. Se usa el mismo avatar en todos los modos.
 * El dibujo del avatar es 100% CSS (sin imágenes), ver assets/avatar/avatar.css.
 */
window.LumiAvatar={
  EXPRESSIONS:['feliz','riendo','sorprendida','triste','enojada','pensativa','dormida','emocionada','saludando'],

  ensure(){
    let el=document.getElementById('lumiAvatar');
    if(!el){
      el=document.createElement('div');
      el.id='lumiAvatar';
      el.className='lumi-avatar';
      el.setAttribute('aria-hidden','true'); // decorativo, no interactivo
      // Sin emojis: cara 100% CSS puro (luego se cambiará por avatar final).
      el.innerHTML='<div class="lumi-avatar-face"><span class="la-eye la-eye-l"></span><span class="la-eye la-eye-r"></span><span class="la-mouth"></span></div><span class="la-hand" hidden></span>';
      document.body.appendChild(el);
    }
    return el;
  },

  setExpression(name){
    const el=this.ensure();
    const exp=this.EXPRESSIONS.includes(name)?name:'pensativa';
    this.EXPRESSIONS.forEach(e=>el.classList.remove('la-'+e));
    el.classList.add('la-'+exp);
    el.dataset.expression=exp;
    // La mano de "saludando" solo existe en esa expresión (CSS puro, sin emoji).
    const hand=el.querySelector('.la-hand');
    if(hand)hand.hidden=(exp!=='saludando');
  },

  show(expression){
    const el=this.ensure();
    if(expression)this.setExpression(expression);
    el.classList.add('la-visible');
  },

  hide(){
    const el=document.getElementById('lumiAvatar');
    if(el)el.classList.remove('la-visible');
  },

  /*
   * Deduce una expresión a partir de texto (respuesta de Lumi) y el estado
   * de ánimo/eventos del momento. Heurística simple por palabras clave.
   */
  detectExpression(text,{badDay=false,insulted=false,jealous=false,thinking=false}={}){
    if(thinking)return 'pensativa';
    if(insulted)return 'enojada';
    if(jealous)return 'sorprendida';
    if(badDay)return 'triste';
    const t=(text||'').toLowerCase();
    if(/jaja|jeje|😂|🤣/.test(t))return 'riendo';
    if(/wow|no puede ser|en serio|increíble/.test(t))return 'sorprendida';
    if(/hola|qué bola|bienvenid/.test(t))return 'saludando';
    if(/genial|qué bien|me encanta|😄|🎉/.test(t))return 'emocionada';
    if(/triste|lo siento|lamento/.test(t))return 'triste';
    if(/cansad|sueño/.test(t))return 'dormida';
    return 'feliz';
  }
};
