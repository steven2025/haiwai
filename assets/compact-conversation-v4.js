/* Compact candidate portal and a single voice-driven, animated conversation. */
const CONVERSATION={host:null,rows:new Map(),raf:0,follow:true,stamp:0};
const compactShell=renderShell;
renderShell=function(){compactShell();if(!SIMPLE.auth||examiner())return;const main=$('main.portal-shell');main?.classList.add('candidate-compact');const profile=$('.portal-content>section.card');if(profile&&SIMPLE.profile){const c=SIMPLE.profile;profile.classList.add('compact-profile');profile.innerHTML=`<div class="compact-person"><span class="avatar">${practicePortrait(c)}</span><div><div class="compact-name"><h1>${esc(c.name)}</h1><span class="pill teal">${c.fictional?'虚拟演示身份':'应聘者'}</span></div><p><strong>${esc(c.job)}</strong><span>${esc(c.country)} · ${esc(c.exp)}经验</span></p></div></div>${dossierLinks(c)}`;}const label=$('.simple-language-panel>b');if(label)label.textContent='面试语言';};
function conversationCharacters(text){return typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);}
function conversationTarget(row,text){if(row.target===text)return;const next=conversationCharacters(text),old=conversationCharacters(row.shown);let common=0;while(common<old.length&&common<next.length&&old[common]===next[common])common++;row.shown=old.slice(0,common).join('');row.target=text;row.chars=next;row.position=common;row.body.textContent=row.shown;}
function conversationTick(time){
 CONVERSATION.raf=0;
 const host=CONVERSATION.host;
 if(!host?.isConnected)return;
 let pending=false,changed=false;
 for(const row of CONVERSATION.rows.values()){
  const question=row.node.classList.contains('interviewer');
  const interval=question?55:22;
  if(row.position<row.chars.length && time>=(row.nextTick||0)){
   const step=question?1:Math.max(1,Math.ceil((row.chars.length-row.position)/35));
   row.position=Math.min(row.chars.length,row.position+step);
   row.shown=row.chars.slice(0,row.position).join('');
   row.body.textContent=row.shown;
   row.nextTick=time+interval;
   changed=true;
  }
  const typing=row.position<row.chars.length;
  row.body.classList.toggle('chat-typing',typing);
  pending=pending||typing;
 }
 if(changed && CONVERSATION.follow)host.scrollTop=host.scrollHeight;
 if(pending)CONVERSATION.raf=requestAnimationFrame(conversationTick);
}
function renderConversation(){const host=$('#ai-transcript');if(!host)return;if(CONVERSATION.host!==host){cancelAnimationFrame(CONVERSATION.raf);CONVERSATION.raf=0;CONVERSATION.rows.clear();CONVERSATION.host=host;CONVERSATION.follow=true;host.innerHTML='';host.setAttribute('aria-label','AI 面试提问与我的回答');host.addEventListener('scroll',()=>{CONVERSATION.follow=host.scrollHeight-host.scrollTop-host.clientHeight<100;});}
 const seen=new Set(),messages=[];for(const m of AI.transcript){if(!m.src?.trim())continue;const key=m.qIndex+':'+m.who+':'+(m.who==='candidate'?m.dir+':':'')+m.src.trim();if(seen.has(key))continue;seen.add(key);messages.push({id:m.id,who:m.who,text:m.src,label:m.who==='interviewer'?(m.dir==='首题追问'?'首题追问':`核心问题 ${m.qIndex+1} / ${AI_QUESTIONS.length}`):'我的回答'});}
 const last=messages.at(-1),draft=MEET.currentAnswer?.trim();if(draft&&!(last?.who==='candidate'&&last.text===draft))messages.push({id:'draft-answer',who:'candidate',text:draft,label:MEET.recognizing?'正在回答':'我的回答 · 待确认'});
 const ids=new Set(messages.map(m=>m.id));for(const [id,row] of CONVERSATION.rows){if(!ids.has(id)){row.node.remove();CONVERSATION.rows.delete(id);}}
 for(const [i,m] of messages.entries()){let row=CONVERSATION.rows.get(m.id);if(!row){const node=document.createElement('article');node.className='chat-row '+m.who;const head=document.createElement('header'),speaker=document.createElement('b'),label=document.createElement('span'),body=document.createElement('div');speaker.textContent=m.who==='interviewer'?'AI 面试官':aiCandidate().name;head.append(speaker,label);body.className='chat-type-text';node.append(head,body);host.append(node);row={node,body,label,chars:[],position:0,target:'',shown:''};CONVERSATION.rows.set(m.id,row);}row.label.textContent=m.label;row.node.classList.toggle('is-latest',i===messages.length-1);conversationTarget(row,m.text);}
 if(!messages.length&&!host.querySelector('.chat-empty')){const empty=document.createElement('p');empty.className='chat-empty';empty.textContent='正在准备面试问题…';host.append(empty);}if(messages.length)host.querySelector('.chat-empty')?.remove();
 if(!CONVERSATION.raf)CONVERSATION.raf=requestAnimationFrame(conversationTick);
}
aiPanelContent=function(){return '';};
aiQuestionCardHTML=function(){return '';};
function conversationControls(){const host=$('#ai-actions');if(!host)return;const text=AI.followupActive?'首题追问':`核心问题 ${AI.index+1} / ${AI_QUESTIONS.length}`;host.innerHTML=`<div class="conversation-controls"><span class="pill teal">${text}</span><button class="btn btn-ghost btn-sm" data-action="ai-replay">${icon('rotate')} 重播提问</button><button class="btn btn-ghost btn-sm" data-action="meet-clear">重新回答</button><button class="btn btn-blue" data-action="meet-mic">${icon('mic')} ${MEET.recognizing?'暂停识别':'开始回答'}</button><button class="btn btn-primary" data-action="meet-submit">${icon('check')} 回答完成</button></div>`;}
renderMeetAnswerBox=function(){const host=$('#meet-answer-wrap');if(host){host.classList.add('conversation-buffer');host.innerHTML='<input id="meet-answer" type="hidden">';$('#meet-answer').value=MEET.currentAnswer||'';}conversationControls();renderConversation();};
updateAIQuestion=function(){const card=$('#ai-qcard');if(card)card.replaceChildren();conversationControls();const btn=$('#ai-main-btn');if(btn)btn.hidden=true;updateAIProgress();renderConversation();};
const conversationAdd=addAITranscript;
addAITranscript=function(who,src,tr,dir,live){const id=conversationAdd(who,src,tr,dir,live);if(who==='candidate'){const draft=CONVERSATION.rows.get('draft-answer');if(draft&&draft.target===src){CONVERSATION.rows.delete('draft-answer');CONVERSATION.rows.set(id,draft);}}renderConversation();return id;};
const conversationUpdate=updateAITranscript;
updateAITranscript=function(id,field,value){conversationUpdate(id,field,value);renderConversation();};
const conversationCaption=setMyCaption;
setMyCaption=function(src,note){conversationCaption(src,note);renderConversation();};
const conversationStatus=setMeetStatus;
setMeetStatus=function(text){conversationStatus(/输入|文字作答/.test(text)?'点击「开始回答」，说完后点击「回答完成」':text);};
function recognitionNotice(text){setMeetStatus(text);let el=$('#recognition-notice');const host=$('#ai-actions');if(!host)return;if(!el){el=document.createElement('p');el.id='recognition-notice';el.setAttribute('role','status');el.style.cssText='color:#ffd599;font-size:13px;line-height:1.7;margin:10px 0 0';host.append(el);}el.textContent=text;}
meetStartListening=function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){recognitionNotice('当前浏览器未提供语音识别，请在独立的 Chrome 或 Edge 中打开网页后重试');return;}if(MEET.recognizing)return;cancelSpeech();const question=AI.currentQuestion,index=AI.index,baseline=MEET.currentAnswer||'';const current=()=>SIMPLE.activeAI&&index===AI.index&&question===AI.currentQuestion&&!AI.answerSubmitting;
 try{let recognitionError='';const rec=new SR();rec.lang=interviewLang('ai','candidate').locale;rec.interimResults=true;rec.continuous=true;
  rec.onstart=()=>{if(!current())return;MEET.recognizing=true;MEET.speechStat.started=Date.now();setMeetStatus('正在听你回答…');const state=$('#meet-mic-state');if(state)state.textContent='正在识别';conversationControls();};
  rec.onresult=e=>{if(!current())return;let transcript='';for(let i=0;i<e.results.length;i++)transcript+=e.results[i][0].transcript;MEET.currentAnswer=baseline+transcript;const input=$('#meet-answer');if(input)input.value=MEET.currentAnswer;MEET.speechStat.lastAt=Date.now();setMyCaption(MEET.currentAnswer,'');};
  rec.onerror=e=>{if(!current())return;const errors={'not-allowed':'麦克风权限被拒绝，请在地址栏允许麦克风后重试','service-not-allowed':'浏览器禁止语音识别服务，请使用独立浏览器重试','network':'浏览器语音识别服务连接失败；麦克风可能正常，但当前无法转成文字','audio-capture':'未检测到可用麦克风，请检查输入设备','no-speech':'未检测到讲话，请靠近麦克风后重试','language-not-supported':'当前浏览器识别服务不支持所选语言'};recognitionError=errors[e.error]||('语音识别失败：'+e.error);recognitionNotice(recognitionError);};
  rec.onend=()=>{if(MEET.recognition!==rec)return;MEET.recognizing=false;conversationControls();if(recognitionError)recognitionNotice(recognitionError);else setMeetStatus('识别已暂停，可继续回答或确认完成');};MEET.recognition=rec;rec.start();
 }catch(e){recognitionNotice('语音识别启动失败：'+e.name+'，请检查麦克风权限后重试');}
};
const conversationStop=meetStopListening;
meetStopListening=function(){conversationStop();conversationControls();renderConversation();};
aiReplay=function(){if(!AI.started)return aiStart();speakText(AI.currentQuestion,interviewLang('ai','interviewer').locale,{onDone:()=>setMeetStatus('请开始回答')});};
document.addEventListener('click',e=>{if(!e.target.closest('[data-action="meet-clear"]')||!SIMPLE.activeAI)return;e.stopImmediatePropagation();if(typeof asrAbort==='function')asrAbort();else meetStopListening();MEET.currentAnswer='';const input=$('#meet-answer');if(input)input.value='';renderConversation();setMeetStatus('已清空当前回答，可重新开始');},true);

// SpeechRecognition requests microphone access itself; answering must not depend on a camera.
document.addEventListener('click',e=>{if(!SIMPLE.activeAI||!e.target.closest('[data-action="meet-mic"]'))return;e.stopImmediatePropagation();if(MEET.recognizing)meetStopListening();else meetStartListening();},true);
