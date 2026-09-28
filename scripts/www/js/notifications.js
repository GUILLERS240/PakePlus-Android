window.IncognitoNotifications=(()=>{
 const banner=document.querySelector('#notification-banner'),title=document.querySelector('#notification-title'),
 preview=document.querySelector('#notification-preview'),avatar=document.querySelector('#notification-avatar'),
 time=document.querySelector('#notification-time'),progress=document.querySelector('#notification-progress');
 let timer,queue=[],lastChat='';
 function enabled(){return document.querySelector('#notifications-enabled')?.checked!==false}
 function hide(){banner.classList.remove('show');banner.classList.add('hiding');clearTimeout(timer);setTimeout(()=>banner.classList.remove('hiding'),320)}
 function show(data={}){
   if(!enabled())return;
   const now=Date.now(), chatId=data.chatId||data.username||'';
   if(banner.classList.contains('show') && lastChat===chatId){
     queue.push(data); title.textContent=`${queue.length+1} mensajes nuevos de ${data.friend?'@'+data.username:'Incógnito'}`;
     preview.textContent=data.preview||'Tienes nuevos mensajes'; resetTimer(); return;
   }
   lastChat=chatId; queue=[]; banner.dataset.chat=chatId;
   title.textContent=data.friend?`Nuevo mensaje de @${data.username}`:'Nuevo mensaje de Incógnito';
   preview.textContent=data.preview||'Tienes un nuevo mensaje';
   time.textContent='Ahora';
   avatar.innerHTML=(data.friend&&data.avatar)?`<img src="${data.avatar}" alt="">${ICONS.message}<i></i>`:`${ICONS.user}<i></i>`;
   banner.classList.remove('hiding'); requestAnimationFrame(()=>banner.classList.add('show'));
   if(navigator.vibrate)navigator.vibrate([10,30,10]);
   resetTimer();
 }
 function resetTimer(){
   clearTimeout(timer);
   progress.style.animation='none'; void progress.offsetWidth;
   progress.style.animation='notificationProgress 5s linear forwards';
   timer=setTimeout(hide,5000);
 }
 document.querySelector('#notification-close').onclick=e=>{e.stopPropagation();hide()};
 let sy=0;
 banner.addEventListener('touchstart',e=>{sy=e.touches[0].clientY},{passive:true});
 banner.addEventListener('touchend',e=>{if(sy-e.changedTouches[0].clientY>35)hide()},{passive:true});
 banner.onclick=e=>{
   if(e.target.closest('#notification-close'))return;
   hide(); if(window.openChat&&banner.dataset.chat)openChat(banner.dataset.chat);
 };
 return{show,hide};
})();
window.showNotification=IncognitoNotifications.show;