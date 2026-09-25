window.LumiProjects={
  projects:[],active:null,

  async load(){
    const u=await LumiAuth.user();
    if(!u?.id)return;
    let a=[];
    if(LumiDB.client){
      const r=await LumiDB.q('projects','select',{eq:{user_id:u.id},order:'created_at'});
      if(!r.error)a=r.data||[];
      else console.warn('Proyectos:',r.error);
    }
    if(!a.length&&!LumiDB.client)a=JSON.parse(localStorage.getItem('lumi_projects')||'[]');
    this.projects=a;
    if(!this.projects.length)await this.create('General');
    this.active=this.projects[0]?.id;
    localStorage.setItem('lumi_projects',JSON.stringify(this.projects));
    this.render();
  },

  async create(name){
    const u=await LumiAuth.user();
    if(!u?.id)return null;
    let p={id:'local-'+Date.now(),user_id:u.id,name,created_at:new Date().toISOString()};
    if(LumiDB.client){
      const r=await LumiDB.save('projects',{user_id:u.id,name});
      if(!r.error&&r.data?.[0])p=r.data[0];
      else if(r.error)console.warn('No se pudo crear proyecto:',r.error);
    }
    this.projects.push(p);
    localStorage.setItem('lumi_projects',JSON.stringify(this.projects));
    this.active=p.id;
    this.render();
    return p;
  },

  render(){
    const el=document.getElementById('projectList');
    if(!el)return;
    el.innerHTML=this.projects.map(p=>`<button class="project-item ${p.id===this.active?'active':''}" data-project="${p.id}"><span class="svg-icon" data-icon="folder"></span>${escapeHTML(p.name)}</button>`).join('');
    if(window.LumiUI)LumiUI.renderIcons();
  }
};
