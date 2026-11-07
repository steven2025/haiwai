/* Two-way live captions and queued cloud translation audio. */
let LIVE_INTERPRETATION = null;
function liveInterpretationNotice(state,text) {
 if (LIVE_INTERPRETATION !== state) return;
 const el = document.getElementById('live-interpretation-state');
 if (el) el.textContent = text;
}
function liveInterpretationMount() {
 const panel = document.querySelector('#hu-transcript');
 if (!panel) return;
 panel.innerHTML = '<p class="dim">等待双方发言，原文与译文将在此实时显示。</p>';
 document.querySelector('#hu-screen .iv-panel-title').textContent = '实时对话 · 原文与译文';
 const controls = document.querySelector('#hu-screen .rtc-call-actions');
 if (controls) controls.innerHTML = '<span id="live-interpretation-state" role="status">正在连接同传…</span><button class="btn btn-ghost btn-sm" data-action="live-original">收听原声</button><button class="btn btn-ghost btn-sm" data-action="live-audio-resume" hidden>播放译音</button><button class="btn btn-ghost btn-sm" data-action="live-retry">检查同传</button>';
 const local=document.getElementById('hu-stage-label');if(local)local.textContent='我的发言';
 const remote=document.querySelector('#hu-screen .meet-pane:nth-child(2) .meet-caption .label');if(remote)remote.textContent='对方发言';
 if(RTC_SESSION.role==='candidate'){
  const context=document.querySelector('#hu-screen .iv-context');
  if(context)context.innerHTML=`<span class="avatar">${esc(aiCandidate().initial||'我')}</span><div><div class="t">${esc(aiCandidate().name)} · 应聘者</div><div class="s">${esc(aiCandidate().job)}</div></div>`;
 }
}
function liveInterpretationRender(state) {
 const panel = document.getElementById('hu-transcript');
 if (!panel || LIVE_INTERPRETATION !== state) return;
 const bottom = panel.scrollHeight-panel.scrollTop-panel.clientHeight < 80;
 const rows = [...state.rows.values()];
 panel.innerHTML = rows.slice(-150).map(row => `<article class="live-caption ${row.source}"><header>${row.source==='interviewer'?'面试官':'应聘者'} · ${esc(flowLanguage(row.language))}</header><p>${esc(row.text)}</p>${row.translation?`<p class="live-translation">${esc(row.translation)}</p>`:''}</article>`).join('');
 if (bottom) panel.scrollTop = panel.scrollHeight;
 // Only finalized original speech enters the existing evaluation workflow.
 HUMAN.transcript = rows.filter(row=>row.text && row.originalFinal).map((row,i)=>({id:'live-'+i,who:row.source,src:row.text,tr:row.translation,live:false,source:'trtc'}));
 const row = rows.at(-1);
 if (row) {
  const prefix = row.source===state.role?'hu-stage':'hu-sub';
  const src=document.getElementById(prefix+'-src'),tr=document.getElementById(prefix+'-tr');
  if(src)src.textContent=row.text;if(tr)tr.textContent=row.translation;
 }
}
function liveInterpretationMessage(state,event) {
 if (LIVE_INTERPRETATION!==state || state.closed || event.cmdId!==1) return;
 if (!state.tasks.length) { if(state.pending.length<80)state.pending.push(event); return; }
 let message;
 try { message=JSON.parse(new TextDecoder().decode(event.data)); } catch { return; }
 const p=message.payload;
 if(message.type!==10000 || !p || typeof p.roundid!=='string' || p.roundid.length>200)return;
 const task=state.tasks.find(t=>t.botUserId===event.userId && (!p.taskid || t.taskId===p.taskid));
 if(!task || ![task.sourceUserId,task.botUserId].includes(message.sender))return;
 const translated=typeof p.translation_text==='string';
 if(translated && p.translation_language!==task.targetLanguage)return;
 const text=translated?p.translation_text:p.text;
 if(typeof text!=='string'||text.length>12000)return;
 const key=task.taskId+':'+p.roundid;
 let row=state.rows.get(key);
 if(!row){row={source:task.source,language:task.sourceLanguage,text:'',translation:'',originalFinal:false,translationFinal:false,spoken:false,sequence:{}};state.rows.set(key,row);}
 const field=translated?'translation':'text',finalField=translated?'translationFinal':'originalFinal';
 if(row[finalField])return;
 if(Number.isFinite(event.seq) && Number.isFinite(row.sequence[field]) && event.seq<row.sequence[field])return;
 row.sequence[field]=event.seq;row[field]=text;row[finalField]=p.end===true;
 liveInterpretationRender(state);
 if(!translated && row.originalFinal && task.source==='candidate' && state.role==='interviewer'){
  LIVE_ANALYSIS.answers.set(key,text);
  const guide=guideSessions.human;
  if(guide&&!guide.followup){
   clearTimeout(LIVE_ANALYSIS.firstTimer);
   LIVE_ANALYSIS.firstTimer=setTimeout(()=>{
    if(!state.closed&&LIVE_INTERPRETATION===state&&!guide.followup)createFollowUp('human',Array.from(LIVE_ANALYSIS.answers.values()).join('\n'));
   },3000);
  }
 }
 if(translated && row.translationFinal && !row.spoken && task.source!==state.role && !state.original){
  row.spoken=true;
   if(state.queue.length>=12){state.audioError='译音积压，本句仅显示字幕，请稍停片刻';liveInterpretationNotice(state,state.audioError);return;}
  // Keep sentence ordering and API size limits for unusually long utterances.
  const characters=Array.from(text);
  while(characters.length)state.queue.push(characters.splice(0,1500).join(''));
  void liveInterpretationSpeak(state);
 }
}
async function liveInterpretationSpeak(state) {
 if(state.speaking || state.closed || state.original || LIVE_INTERPRETATION!==state)return;
 state.speaking=true;
 try {
  while(state.queue.length && !state.closed && !state.original && LIVE_INTERPRETATION===state){
   const text=state.queue.shift(),epoch=state.audioEpoch;
   const result=await rtcRequest('interpretation/speech',{roomTicket:RTC_SESSION.ticket,text});
   if(state.closed || state.original || epoch!==state.audioEpoch || LIVE_INTERPRETATION!==state)break;
   if(result.language!==state.language || result.mime!=='audio/mpeg')throw Error('译音语言或格式不匹配');
   state.audioError='';
   const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));
   const url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
   try {
    const player=new Audio(url);state.player=player;
    await new Promise((resolve,reject)=>{
     state.finishAudio=resolve;player.onended=resolve;player.onerror=()=>reject(Error('译音播放失败，请检查网络'));
     player.play().catch(()=>{if(state.closed){resolve();return;}state.audioError='请点击「播放译音」启用声音';const button=document.querySelector('[data-action="live-audio-resume"]');if(button)button.hidden=false;liveInterpretationNotice(state,state.audioError);});
    });
   } finally { URL.revokeObjectURL(url);state.player=null;state.finishAudio=null; }
  }
 } catch(e) {state.audioError='译音暂不可用：'+e.message+'。可点击收听原声';liveInterpretationNotice(state,state.audioError);}
 finally {state.speaking=false;if(state.queue.length&&!state.audioError&&!state.closed&&!state.original)void liveInterpretationSpeak(state);}
}
function liveInterpretationClearAudio(state) {
 state.audioEpoch++;state.queue=[];state.player?.pause();state.finishAudio?.();
 const button=document.querySelector('[data-action="live-audio-resume"]');if(button)button.hidden=true;
}
async function liveInterpretationPoll(state,start=false) {
 if(state.closed || LIVE_INTERPRETATION!==state || state.polling)return;
 state.polling=true;
 try {
  const result=await rtcRequest('interpretation/'+(start?'start':'status'),{roomTicket:RTC_SESSION.ticket});
  if(state.closed || LIVE_INTERPRETATION!==state)return;
  if(result.closed){state.closed=true;liveInterpretationClearAudio(state);liveInterpretationNotice(state,'本场同传已结束');return;}
  state.tasks=result.tasks||[];
  for(const event of state.pending.splice(0))liveInterpretationMessage(state,event);
  const failed=state.tasks.find(t=>t.state==='failed');
  liveInterpretationNotice(state,failed?'同传未就绪：'+failed.error:state.audioError|| (result.ready?(state.same?'原声通话 · 实时字幕已连接':state.original?'正在收听原声 · 双语字幕已连接':'双向字幕已连接 · 译音按短句播放'):'正在等待双方语音转录就绪…'));
 } catch(e){liveInterpretationNotice(state,'同传未就绪：'+e.message+'。可点击收听原声');}
 finally{state.polling=false;if(!state.closed&&LIVE_INTERPRETATION===state)state.timer=setTimeout(()=>liveInterpretationPoll(state),8000);}
}
function liveInterpretationBind(client,SDK,credentials) {
 const previous=LIVE_INTERPRETATION;
 const same=credentials.languages.interviewer===credentials.languages.candidate;
 const state={client,room:credentials.strRoomId,role:credentials.role,language:credentials.sourceLanguage,
  same,original:same,closed:false,tasks:[],rows:previous?.room===credentials.strRoomId?previous.rows:new Map(),pending:[],queue:[],audioEpoch:0};
 LIVE_INTERPRETATION=state;liveInterpretationMount();
 if(previous?.room!==state.room){LIVE_ANALYSIS.answers.clear();HUMAN.transcript=[];}
 else liveInterpretationRender(state);
 const originalButton=document.querySelector('[data-action="live-original"]');if(originalButton&&same)originalButton.hidden=true;
 client.on(SDK.EVENT.CUSTOM_MESSAGE,event=>liveInterpretationMessage(state,event));
 client.on(SDK.EVENT.REMOTE_AUDIO_AVAILABLE,({userId})=>{
  if(state.closed||LIVE_INTERPRETATION!==state)return;
  if(userId===credentials.peerUserId)void client.muteRemoteAudio(userId,!state.original).catch(e=>liveInterpretationNotice(state,e.message));
 });
 state.peer=credentials.peerUserId;
 return state;
}
async function liveInterpretationReady(state) {
 await liveInterpretationCleanup();
 await state.client.muteRemoteAudio(state.peer,!state.original);
 void liveInterpretationPoll(state,true);
}
async function liveInterpretationLeave(reconnecting=false) {
 const state=LIVE_INTERPRETATION;
 if(!state)return;
 state.closed=true;clearTimeout(state.timer);liveInterpretationClearAudio(state);
 if(!reconnecting){
  const ticket=RTC_SESSION.ticket;
  try{const pending=JSON.parse(sessionStorage.getItem('live-cleanup-v6')||'[]');sessionStorage.setItem('live-cleanup-v6',JSON.stringify([...new Set([...pending,ticket])]));}catch{}
  try{await rtcRequest('interpretation/stop',{roomTicket:ticket});liveInterpretationForget(ticket);}
  catch(e){showToast('同传停止待确认：'+e.message+'；下次连线将重试清理','warn');}
 }
}
function liveInterpretationForget(ticket){
 try{const pending=JSON.parse(sessionStorage.getItem('live-cleanup-v6')||'[]');sessionStorage.setItem('live-cleanup-v6',JSON.stringify(pending.filter(t=>t!==ticket)));}catch{}
}
async function liveInterpretationCleanup(){
 let pending=[];try{pending=JSON.parse(sessionStorage.getItem('live-cleanup-v6')||'[]');}catch{}
 for(const ticket of pending){try{await rtcRequest('interpretation/stop',{roomTicket:ticket});liveInterpretationForget(ticket);}catch{showToast('上次同传清理暂未确认，请检查云端任务状态','warn');}}
}
document.addEventListener('click',async event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(!['live-original','live-audio-resume','live-retry'].includes(action))return;
 const state=LIVE_INTERPRETATION;if(!state || state.closed)return;
 try{
  if(action==='live-original'){
   state.original=!state.original;state.audioError='';liveInterpretationClearAudio(state);
   await state.client.muteRemoteAudio(state.peer,!state.original);
   event.target.closest('button').textContent=state.original?'收听译音':'收听原声';
   liveInterpretationNotice(state,state.original?'正在收听对方原声':'正在收听译音，等待对方下一句发言');
  }else if(action==='live-audio-resume'){await state.player?.play();state.audioError='';event.target.closest('button').hidden=true;}
  else{clearTimeout(state.timer);await liveInterpretationPoll(state,true);}
 }catch(e){liveInterpretationNotice(state,e.message);}
},true);
