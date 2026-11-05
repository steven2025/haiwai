/* TRTC Web integration, haiwai1. No permanent credentials in this script. */
const RTC_CLOUD='https://1311686407-3wngbki5br.ap-guangzhou.tencentscf.com';
const RTC_SESSION={ticket:'',invite:'',role:'interviewer',roomId:'',client:null,busy:false,connected:false,remote:false,generation:0,taskToken:'',aiEnabled:false};
function rtcIsLocal(){return ['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='8787';}
async function rtcRequest(path,body,adminToken){
 const headers={'Content-Type':'application/json'};if(adminToken)headers.Authorization='Bearer '+adminToken;
 const r=await fetch((rtcIsLocal()?'':RTC_CLOUD)+'/api/trtc/'+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(55000)});
 let d=await r.json();if(d&&typeof d.body==='string')d=JSON.parse(d.body);
 if(!r.ok||!d.ok)throw Error(d.error||'云函数请求失败');return d;
}
function rtcStatus(text){const el=$('#rtc-status');if(el)el.textContent=text;const hu=$('#hu-status');if(hu)hu.textContent=text;const top=$('#hu-screen .live-status');if(top)top.textContent=text;}
function rtcLanguageLock(lock){document.querySelectorAll('[data-mode="human"][data-action="interview-language"]').forEach(b=>b.disabled=lock);}
function rtcControlsHTML(){return `<section class="rtc-room-controls"><h3>真人远程面试</h3><p class="tiny dim">1. 设置双方语言　2. 创建房间并发送邀请　3. 双方加入</p>${interviewLanguageBar('human')}${rtcIsLocal()?'':`<label class="tiny dim" for="rtc-admin">管理员创建口令（仅本次使用，不保存）</label><input id="rtc-admin" type="password" autocomplete="off" placeholder="RTC_ADMIN_TOKEN；应聘者无需填写">`}<div class="dossier-links"><button class="btn btn-primary" data-action="rtc-create">创建面试房间</button><button class="btn btn-ghost" data-action="rtc-health">检查云端连接</button></div><p id="rtc-status" role="status">${RTC_SESSION.ticket?'邀请已载入，点击加入':'尚未创建房间'}</p><label class="tiny dim" for="rtc-public-url">邀请页面的公开 HTTPS 地址（另一台设备使用）</label><input id="rtc-public-url" type="url" value="${esc(localStorage.getItem('rtcPublicPageUrl')||'')}" placeholder="https://你的网页域名/index.html；同机测试可留空"><div id="rtc-invite-area" ${RTC_SESSION.invite?'':'hidden'}><label class="tiny dim" for="rtc-invite-url">应聘者邀请链接</label><textarea id="rtc-invite-url" readonly>${esc(RTC_SESSION.invite)}</textarea><button class="btn btn-ghost btn-sm" data-action="rtc-copy">复制邀请链接</button><p class="tiny dim">另一台设备需打开可访问的 HTTPS 网页地址；localhost 链接仅适合同机测试。</p></div><div class="dossier-links"><button class="btn btn-blue" data-action="rtc-join" data-video="1" ${RTC_SESSION.ticket?'':'disabled'}>加入视频面试</button><button class="btn btn-ghost" data-action="rtc-join" data-video="0" ${RTC_SESSION.ticket?'':'disabled'}>仅语音加入</button></div><p class="tiny dim">当前阶段直接播放双方原声。同传与录制不会自动开启。</p></section>`;}
const rtcOriginalLobby=openHumanLobby;
openHumanLobby=function(){rtcOriginalLobby();const side=$('.lobby-side');if(!side)return;side.innerHTML=rtcControlsHTML();if(RTC_SESSION.role==='candidate'){side.querySelector('[data-action="rtc-create"]').remove();side.querySelector('#rtc-admin')?.remove();side.querySelector('label[for="rtc-admin"]')?.remove();}rtcLanguageLock(!!RTC_SESSION.ticket);};
async function rtcCreateRoom(){
 if(RTC_SESSION.busy||RTC_SESSION.connected)return;
 RTC_SESSION.busy=true;const field=$('#rtc-admin'),admin=field?.value.trim();
 try{const publicPage=$('#rtc-public-url')?.value.trim();if(publicPage&&new URL(publicPage).protocol!=='https:')throw Error('邀请页面必须使用 HTTPS');rtcStatus('正在创建房间…');const response=await rtcRequest('rooms',{languages:{...interviewLanguages.human}},admin);RTC_SESSION.ticket=response.interviewerTicket;RTC_SESSION.roomId=response.roomId;RTC_SESSION.role='interviewer';
 const u=new URL(publicPage||location.href);if(publicPage && u.protocol!=='https:')throw Error('另一台设备请使用公开 HTTPS 网页地址');if(publicPage)localStorage.setItem('rtcPublicPageUrl',u.href);u.search='';u.hash=new URLSearchParams({rtc_invite:response.candidateTicket,rtc_candidate:aiCandidate().id}).toString();RTC_SESSION.invite=u.href;
 const side=$('.lobby-side');if(side)side.innerHTML=rtcControlsHTML();rtcLanguageLock(true);rtcStatus('房间已创建，请将邀请链接发给应聘者');
 }catch(e){rtcStatus('创建失败：'+e.message);showToast(e.message,'warn');}finally{if(field)field.value='';RTC_SESSION.busy=false;}
}
async function rtcLoadSDK(){if(window.TRTC)return window.TRTC;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/trtc-sdk/trtc.js';script.onload=resolve;script.onerror=()=>reject(Error('TRTC SDK 加载失败，请检查 assets/trtc-sdk/trtc.js'));document.head.appendChild(script);});if(!window.TRTC)throw Error('TRTC SDK 未就绪');return window.TRTC;}
const rtcOriginalRoom=humanRoomHTML;
humanRoomHTML=function(){let html=rtcOriginalRoom();html=html.replace('<video id="local-video" autoplay playsinline muted></video>','<div id="rtc-local-view" class="rtc-video-view"></div>').replace('<video id="remote-video" autoplay playsinline hidden></video>','<div id="rtc-remote-view" class="rtc-video-view"></div>');html=html.replace('本地预览 · 等待接入','正在连接房间').replaceAll('双向语言互译</span>','原声通话</span>').replace('远程视频将在连接成功后显示。当前尚未接入 TRTC，不会由 AI 代替应聘者回答。','对方加入后，视频画面会自动显示。').replace('当前仅支持本地设备预览。语言按钮用于配置面试偏好，云端翻译与译音尚未启用。','已接入 TRTC 音视频。当前播放原声，云端字幕与译音尚未开启。').replace('当前为本地候场预览，远程连线及云端同传待接入。','房间语言已锁定；更换语言请退出后重新创建房间。').replace('尚未建立远程连接','TRTC 连接状态见顶部').replace('当前未连接，不生成模拟对话。','字幕同传尚未开启，不生成模拟对话。');
 if(RTC_SESSION.role==='candidate'){html=html.replace('面试官 · 你','应聘者 · 你').replace('我 · 招聘官','我 · 应聘者').replace('等待真人应聘者加入','等待真人面试官加入').replace('真人应聘者</span>','真人面试官</span>');html=html.replace('<div class="n">林岚</div>','<div class="n">'+esc(aiCandidate().name)+'</div>').replace('<div class="n">'+esc(aiCandidate().name)+'</div>\n              <div class="r">应聘者 · 尚未连线</div>','<div class="n">林岚</div><div class="r">真人面试官</div>');}
 return html.replace('<div class="iv-footnote">','<div class="rtc-call-actions"><button class="btn btn-ghost btn-sm" data-action="rtc-reconnect">重新连接</button><span>双方原声 · 同传未开启 · 未录制</span></div><div class="iv-footnote">');};
updateHumanHeader=function(){rtcStatus(RTC_SESSION.connected?(RTC_SESSION.remote?'双方已连线 · 原声通话':'已进房 · 等待对方加入'):'尚未连接');document.querySelectorAll('[data-action="human-mic"]').forEach(b=>{b.classList.toggle('active',HUMAN.micOn);b.innerHTML=icon(HUMAN.micOn?'mic':'micOff');});document.querySelectorAll('[data-action="human-cam"]').forEach(b=>{b.classList.toggle('active',HUMAN.camOn);b.innerHTML=icon(HUMAN.camOn?'video':'videoOff');});const badge=$('#hu-screen .meet-pane:first-child .meet-pane-top .stage-badge:last-child');if(badge)badge.textContent=HUMAN.camOn?'CAMERA ON':'CAMERA OFF';const remoteRole=$('#hu-screen .meet-pane:nth-child(2) .meet-pane-name .r');if(remoteRole)remoteRole.textContent=RTC_SESSION.remote?'真人参与者 · 已连接':'真人参与者 · 待加入';};
async function rtcJoin(video){
 if(RTC_SESSION.busy||RTC_SESSION.connected)return;if(!RTC_SESSION.ticket){showToast('请先创建房间或打开邀请链接','warn');return;}
 RTC_SESSION.busy=true;const generation=++RTC_SESSION.generation;
 try{
  needSecureRTC();rtcStatus('正在获取进房凭证…');
  const [credentials,SDK]=await Promise.all([rtcRequest('join',{roomTicket:RTC_SESSION.ticket}),rtcLoadSDK()]);
  if(generation!==RTC_SESSION.generation)return;
  RTC_SESSION.role=credentials.role;RTC_SESSION.roomId=credentials.strRoomId;interviewLanguages.human={...credentials.languages};
  for(const stream of [HUMAN.stream,HUMAN.previewStream])stream?.getTracks().forEach(t=>t.stop());HUMAN.stream=null;HUMAN.previewStream=null;HUMAN.started=true;HUMAN.ended=false;HUMAN.camOn=false;HUMAN.micOn=false;
  currentView='human-room';app.innerHTML=humanRoomHTML();rtcLanguageLock(true);if(RTC_SESSION.role==='interviewer'){renderGuide('human');prepareGuide('human');}else{$('#interview-guide-human')?.remove();$('#hu-screen .iv-panel-title').textContent='面试记录 · 等待字幕接入';}
  const client=SDK.create();RTC_SESSION.client=client;
  const active=()=>generation===RTC_SESSION.generation&&RTC_SESSION.client===client;
  const remoteWaiting=text=>{const p=$('#hu-screen .waiting-remote');if(p){p.style.display='grid';const h=p.querySelector('h3');if(h)h.textContent=text;}};
  client.on(SDK.EVENT.REMOTE_USER_ENTER,({userId})=>{if(!active()||!userId.startsWith(RTC_SESSION.role==='interviewer'?'c_':'i_'))return;RTC_SESSION.remote=true;updateHumanHeader();remoteWaiting('对方已加入，等待摄像头画面');});
  client.on(SDK.EVENT.REMOTE_USER_EXIT,({userId})=>{if(!active()||!userId.startsWith(RTC_SESSION.role==='interviewer'?'c_':'i_'))return;RTC_SESSION.remote=false;$('#rtc-remote-view')?.replaceChildren();remoteWaiting('对方已离开，等待重新加入');updateHumanHeader();});
  client.on(SDK.EVENT.REMOTE_VIDEO_AVAILABLE,async({userId,streamType})=>{if(!active()||!userId.startsWith(RTC_SESSION.role==='interviewer'?'c_':'i_'))return;try{await client.startRemoteVideo({userId,streamType,view:'rtc-remote-view'});if(active()){$('#hu-screen .waiting-remote').style.display='none';RTC_SESSION.remote=true;updateHumanHeader();}}catch(e){if(active())rtcStatus('远端视频播放失败，请重新连接');}});
  client.on(SDK.EVENT.REMOTE_VIDEO_UNAVAILABLE,({userId})=>{if(active()&&userId.startsWith(RTC_SESSION.role==='interviewer'?'c_':'i_'))remoteWaiting('对方已关闭摄像头，仍可语音通话');});
  client.on(SDK.EVENT.CONNECTION_STATE_CHANGED,e=>{if(!active())return;RTC_SESSION.connected=e.state==='CONNECTED';if(e.state==='CONNECTING')rtcStatus('连接中，请稍候…');else if(e.state==='DISCONNECTED')rtcStatus('连接已断开，请检查网络后重新连接');else updateHumanHeader();});
  client.on(SDK.EVENT.ERROR,()=>{if(active())rtcStatus('音视频发生错误，请检查设备权限及网络');});
  client.on(SDK.EVENT.KICKED_OUT,()=>{if(active()){RTC_SESSION.connected=false;rtcStatus('已从房间断开，可能同一邀请在其他设备打开');}});
  client.on(SDK.EVENT.AUTOPLAY_FAILED,()=>{if(active())showToast('浏览器阻止播放，请点击页面中的播放提示','warn');});
  rtcStatus('正在连接 TRTC…');await client.enterRoom({sdkAppId:credentials.sdkAppId,strRoomId:credentials.strRoomId,userId:credentials.userId,userSig:credentials.userSig,scene:'rtc'});
  if(!active()){await client.exitRoom();client.destroy();return;}
  RTC_SESSION.connected=true;startHumanTimer();
  try{await client.startLocalAudio();HUMAN.micOn=true;}catch{showToast('麦克风未开启，请允许权限后点击麦克风','warn');}
  if(video){try{await client.startLocalVideo({view:'rtc-local-view',option:{profile:'480p'}});HUMAN.camOn=true;$('#local-placeholder').style.display='none';}catch{showToast('摄像头未开启，仍可语音面试','warn');}}
  updateHumanHeader();
 }catch(e){rtcStatus('加入失败：'+e.message);showToast(e.message,'warn');if(RTC_SESSION.client){try{await RTC_SESSION.client.exitRoom();}catch{}try{RTC_SESSION.client.destroy();}catch{}RTC_SESSION.client=null;}RTC_SESSION.connected=false;}
 finally{RTC_SESSION.busy=false;}
}
function needSecureRTC(){if(!window.isSecureContext)throw Error('视频面试需使用 HTTPS；本机可使用 http://127.0.0.1:8787');}
async function rtcLeave(){++RTC_SESSION.generation;const client=RTC_SESSION.client;RTC_SESSION.client=null;RTC_SESSION.connected=false;RTC_SESSION.remote=false;stopHumanTimer();if(client){try{await client.stopLocalAudio();}catch{}try{await client.stopLocalVideo();}catch{}try{await client.exitRoom();}catch{}try{client.destroy();}catch{}}HUMAN.micOn=false;HUMAN.camOn=false;}
const rtcOldMic=toggleHumanMic,rtcOldCam=toggleHumanCam;
toggleHumanMic=async function(){if(RTC_SESSION.busy)return;if(!RTC_SESSION.client)return rtcOldMic();try{if(HUMAN.micOn){await RTC_SESSION.client.stopLocalAudio();HUMAN.micOn=false;}else{await RTC_SESSION.client.startLocalAudio();HUMAN.micOn=true;}updateHumanHeader();}catch{showToast('麦克风操作失败，请检查设备权限','warn');}};
toggleHumanCam=async function(){if(RTC_SESSION.busy)return;if(!RTC_SESSION.client)return rtcOldCam();try{if(HUMAN.camOn){await RTC_SESSION.client.stopLocalVideo();HUMAN.camOn=false;$('#local-placeholder').style.display='flex';}else{await RTC_SESSION.client.startLocalVideo({view:'rtc-local-view',option:{profile:'480p'}});HUMAN.camOn=true;$('#local-placeholder').style.display='none';}updateHumanHeader();}catch{showToast('摄像头操作失败，请检查设备权限','warn');}};
const rtcOldEnd=humanEndConfirm;
humanEndConfirm=async function(){await rtcLeave();RTC_SESSION.ticket='';RTC_SESSION.invite='';rtcOldEnd();};
endHuman=function(){openOverlay(`<div class="modal-mask" data-action="close-modal"><div class="modal-card"><div class="modal-head"><h3>离开真人面试？</h3></div><p style="padding:20px">将关闭本机摄像头、麦克风并退出房间。对方会看到离线提示；不会生成虚构评估报告。</p><div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">继续面试</button><button class="btn btn-red" data-action="human-end-confirm">退出房间</button></div></div></div>`);};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;switch(b.dataset.action){
 case 'rtc-create':await rtcCreateRoom();break;
 case 'rtc-health':try{const h=await rtcRequest('health');RTC_SESSION.aiEnabled=h.aiEnabled;rtcStatus(h.configured?'云函数已连接 · '+(h.aiEnabled?'同传能力已配置，尚未启动':'同传未开启'):'云函数环境变量尚未填齐');}catch(err){rtcStatus('连接检查失败：'+err.message);}break;
 case 'rtc-join':await rtcJoin(b.dataset.video==='1');break;
 case 'rtc-copy':try{await navigator.clipboard.writeText(RTC_SESSION.invite);showToast('邀请链接已复制');}catch{$('#rtc-invite-url')?.select();showToast('请复制选中的邀请链接');}break;
 case 'rtc-reconnect':if(!RTC_SESSION.busy){await rtcLeave();await rtcJoin(true);}break;
}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="interview-language"][data-mode="human"]');if(b&&RTC_SESSION.ticket){e.stopImmediatePropagation();showToast('房间语言已锁定，请退出并重新创建以更改');}},true);
window.addEventListener('pagehide',()=>{rtcLeave();});
const rtcBoot=bootDemo;
bootDemo=function(){const params=new URLSearchParams(location.hash.replace(/^#/,''));const ticket=params.get('rtc_invite');if(!ticket){rtcBoot();return;}
 RTC_SESSION.ticket=ticket;RTC_SESSION.role='candidate';const id=params.get('rtc_candidate');if(S.candidates.some(c=>c.id===id))AI_CURRENT_CANDIDATE=id;
 session={role:'candidate',name:aiCandidate().name};openHumanLobby();history.replaceState(null,'','#'+params.toString());rtcStatus('收到真人面试邀请，准备好后点击加入');
};