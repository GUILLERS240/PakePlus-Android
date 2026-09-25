window.LumiNotifications={
 async init(){if(!('Notification' in window))return;try{if(localStorage.getItem('lumi_notifications')==='1'&&Notification.permission==='default')await Notification.requestPermission();}catch(e){}},
 async enable(){localStorage.setItem('lumi_notifications','1');if('Notification'in window&&Notification.permission==='default')await Notification.requestPermission();},
 show(title,body){if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body,icon:'assets/icons/lumi.svg'});}
};
