(()=> {
  const slides=[...document.querySelectorAll('.slide')], dots=document.querySelector('#slide-dots'),
    counter=document.querySelector('#slide-counter'), actions=document.querySelector('#onboard-actions'),
    track=document.querySelector('#slides'), skip=document.querySelector('#skip-onboarding');
  let index=0,startX=0,lastX=0,dragging=false;
  const ease='cubic-bezier(.16,1,.3,1)';
  slides.forEach((_,i)=>{const d=document.createElement('i');d.className='dot'+(i===0?' active':'');dots.appendChild(d)});
  function haptic(ms=8){if(navigator.vibrate)navigator.vibrate(ms)}
  function resetPositions(){
    slides.forEach((s,i)=>{
      s.style.transition='';
      s.style.transform=i===index?'translate3d(0,0,0) scale(1)':i<index?'translate3d(-12%,0,0) scale(.97)':'translate3d(12%,0,0) scale(.97)';
    });
  }
  function render(){
    slides.forEach((s,i)=>{s.classList.toggle('active',i===index);s.classList.toggle('is-before',i<index);s.classList.toggle('is-after',i>index)});
    dots.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===index));
    counter.textContent=`${index+1}/${slides.length}`;
    actions.innerHTML=index===slides.length-1
      ? '<div class="final-actions"><button class="btn btn-primary btn-lg" id="create-account">Crear cuenta</button><button class="btn btn-outline btn-lg" id="existing-account">Ya tengo cuenta</button></div>'
      : '<button class="btn btn-primary btn-lg" id="next-slide">Siguiente</button>';
    if(index===slides.length-1){
      document.querySelector('#create-account').onclick=()=>{haptic();AppNav.goTo('register')};
      document.querySelector('#existing-account').onclick=()=>{haptic();AppNav.goTo('login')};
    }else document.querySelector('#next-slide').onclick=()=>go(index+1);
    requestAnimationFrame(resetPositions);
  }
  function go(next){
    next=Math.max(0,Math.min(slides.length-1,next));
    if(next===index)return;
    const dir=next>index?1:-1, current=slides[index], target=slides[next];
    target.classList.add('active'); target.style.transition=`transform 500ms ${ease},opacity 450ms ${ease}`;
    current.style.transition=`transform 500ms ${ease},opacity 450ms ${ease}`;
    target.style.transform=`translate3d(${dir*100}%,0,0) scale(.985)`;
    requestAnimationFrame(()=>{
      current.style.transform=`translate3d(${-dir*100}%,0,0) scale(.97)`;
      current.style.opacity='0';
      target.style.transform='translate3d(0,0,0) scale(1)';
      target.style.opacity='1';
    });
    index=next;haptic();setTimeout(render,510);
  }
  function onStart(x){
    dragging=true;startX=lastX=x;
    slides.forEach(s=>s.style.transition='none');
  }
  function onMove(x){
    if(!dragging)return;
    lastX=x; const dx=x-startX, w=track.clientWidth||1, dir=dx<0?1:-1;
    const current=slides[index];
    current.style.transform=`translate3d(${dx}px,0,0) scale(${1-Math.min(.025,Math.abs(dx)/w*.025)})`;
    current.style.opacity=String(1-Math.min(.35,Math.abs(dx)/w*.35));
    const targetIndex=index+dir;
    if(slides[targetIndex]){
      const target=slides[targetIndex];
      target.classList.add('active');
      target.style.transition='none';
      target.style.opacity=String(.45+Math.min(.55,Math.abs(dx)/w));
      target.style.transform=`translate3d(${dir*w+dx}px,0,0) scale(.985)`;
    }
  }
  function onEnd(){
    if(!dragging)return;dragging=false;
    const dx=lastX-startX,w=track.clientWidth||1;
    if(Math.abs(dx)>Math.min(70,w*.16)) go(index+(dx<0?1:-1));
    else{
      slides.forEach(s=>s.style.transition=`transform 350ms ${ease},opacity 300ms ${ease}`);
      resetPositions();setTimeout(render,360);
    }
  }
  track.addEventListener('touchstart',e=>onStart(e.touches[0].clientX),{passive:true});
  track.addEventListener('touchmove',e=>onMove(e.touches[0].clientX),{passive:true});
  track.addEventListener('touchend',onEnd,{passive:true});
  track.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){track.setPointerCapture(e.pointerId);onStart(e.clientX)}});
  track.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&dragging)onMove(e.clientX)});
  track.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')onEnd()});
  skip.onclick=()=>{haptic();AppNav.goTo('login')};
  render();
})();