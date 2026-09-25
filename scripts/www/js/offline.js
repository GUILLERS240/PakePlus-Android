window.LumiOffline={
 db:null,
 async init(){this.db=await new Promise((res,rej)=>{const r=indexedDB.open(LUMI_CONFIG.DB_NAME,LUMI_CONFIG.DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;['conversations','messages','queue'].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});this.update();addEventListener('online',()=>{this.update();this.flush();});addEventListener('offline',()=>this.update());},
 async put(store,obj){return new Promise((res,rej)=>{const tx=this.db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});},
 async all(store){return new Promise((res,rej)=>{const r=this.db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});},
 update(){const b=document.getElementById('offlineBanner');if(b){b.hidden=navigator.onLine;b.textContent=LUMI_STRINGS.es.offline;}},
 async queue(item){await this.put('queue',item);},
 async flush(){if(!navigator.onLine||!this.db)return;const q=await this.all('queue');for(const item of q){try{if(item.type==='message')await LumiChat.send(item.text,true);const tx=this.db.transaction('queue','readwrite');tx.objectStore('queue').delete(item.id);}catch(e){break;}}}
};
