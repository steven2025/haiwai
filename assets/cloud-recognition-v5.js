/* AI answers use TRTC ASR directly; no browser SpeechRecognition fallback. */
const CLOUD_ASR={active:null,submitting:false};
function asrCaptureStop(s){s.stream?.getTracks().forEach(t=>t.stop());s.node?.disconnect();s.source?.disconnect();s.context?.close().catch(()=>{});clearTimeout(s.limit);}
function asrDone(s,error){if(s.done)return;s.done=true;clearTimeout(s.timeout);asrCaptureStop(s);try{s.ws?.close();}catch{}if(CLOUD_ASR.active===s){CLOUD_ASR.active=null;MEET.recognizing=false;MEET.recognition=null;conversationControls();renderConversation();if(error)recognitionNotice(error);else recognitionNotice(MEET.currentAnswer?.trim()?'识别完成，可以继续回答或点击「回答完成」':'未识别到回答，请检查麦克风后重新开始');}s.resolve?.(!error);}
function asrAbort(){const s=CLOUD_ASR.active;if(s)asrDone(s);}
meetStartListening=async function(){
 if(CLOUD_ASR.active||CLOUD_ASR.submitting)return;
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){recognitionNotice('请通过 HTTPS 网站或 localhost 打开页面，再允许麦克风；不要直接打开 HTML 文件');return;}
 cancelSpeech();const s={index:AI.index,question:AI.currentQuestion,baseline:MEET.currentAnswer||'',segments:new Map(),done:false,ready:false};CLOUD_ASR.active=s;
 const valid=()=>CLOUD_ASR.active===s&&!s.done&&SIMPLE.activeAI&&s.index===AI.index&&s.question===AI.currentQuestion;
 recognitionNotice('正在连接腾讯云语音识别，请允许使用麦克风…');
 try{
  const AC=window.AudioContext||window.webkitAudioContext;s.context=new AC({sampleRate:16000});await s.context.resume();
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
  if(!valid()){stream.getTracks().forEach(t=>t.stop());return;}s.stream=stream;
  await s.context.audioWorklet.addModule(new URL('assets/pcm-recorder-v5.js',document.baseURI));if(!valid())return;
  const d=await rtcRequest('speech/recognition-session',{analysisTicket:analysisTicket()});if(!valid())return;
  if(d.provider!=='trtc'||d.language!==interviewLang('ai','candidate').id||!d.url?.startsWith('wss://asr.cloud-rtc.com/asr/v3?'))throw Error('识别服务返回的语言或地址无效');
  s.ws=new WebSocket(d.url);s.timeout=setTimeout(()=>asrDone(s,'腾讯云识别连接超时，请检查网络后重试'),15000);
  s.ws.onopen=()=>{if(valid())s.ws.send(JSON.stringify(d.start));else s.ws.close();};
  s.ws.onerror=()=>asrDone(s,'无法连接腾讯云实时识别，请检查网络后重试');
  s.ws.onclose=()=>{if(!s.done)asrDone(s,'腾讯云识别连接已断开，已识别的内容保留，请重试');};
  s.ws.onmessage=e=>{if(!valid())return;try{const m=JSON.parse(e.data);if(m.code!==0){const errors={4002:'腾讯云识别鉴权失败，请核对云函数 SDKAppID 和密钥',4003:'此 TRTC 应用尚未开通实时语音识别',4004:'腾讯云语音识别额度已用完',4005:'腾讯云账户欠费',4006:'腾讯云识别并发数已达上限',4008:'音频发送中断，请保持页面在前台'};asrDone(s,errors[m.code]||`腾讯云识别失败（${m.code}）：${m.message||'请重试'}`);return;}
   if(!s.ready){s.ready=true;clearTimeout(s.timeout);MEET.recognizing=true;MEET.speechStat.started=Date.now();conversationControls();recognitionNotice('腾讯云正在识别 · '+flowLanguage(d.language)+'，请开始回答');
    s.source=s.context.createMediaStreamSource(stream);s.node=new AudioWorkletNode(s.context,'interview-pcm');s.node.port.onmessage=ev=>{if(!valid()||s.stopping)return;if(s.ws.readyState!==WebSocket.OPEN)return;if(s.ws.bufferedAmount>64000){asrDone(s,'网络发送积压，识别已暂停，请检查网络后重试');return;}s.ws.send(ev.data);};s.source.connect(s.node);s.node.connect(s.context.destination);s.limit=setTimeout(()=>meetStopListening(),Math.min(540,d.expiresIn)*1000);
   }
   if(m.result&&Number.isInteger(m.result.index)&&typeof m.result.voice_text_str==='string'){s.segments.set(m.result.index,m.result.voice_text_str);const join=['en','fr','es','vi'].includes(d.language)?' ':'';MEET.currentAnswer=[s.baseline,[...s.segments].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(join)].filter(Boolean).join(join);const input=$('#meet-answer');if(input)input.value=MEET.currentAnswer;MEET.speechStat.lastAt=Date.now();setMyCaption(MEET.currentAnswer,'');}
   if(m.final===1)asrDone(s);
  }catch(err){asrDone(s,'识别结果处理失败：'+err.message);}};
 }catch(e){if(valid())asrDone(s,e.name==='NotAllowedError'?'麦克风权限被拒绝，请在地址栏允许麦克风':e.name==='NotFoundError'?'未检测到麦克风':/Unknown.*endpoint/i.test(e.message)?'云函数尚未更新：请部署 v5 语音识别版本':e.message);}
};
meetStopListening=function(){const s=CLOUD_ASR.active;if(!s)return Promise.resolve(true);if(s.finishing)return s.finishing;if(!s.ready){asrDone(s,'已取消识别连接，请重新开始回答');return Promise.resolve(false);}s.stopping=true;asrCaptureStop(s);recognitionNotice('正在确认最后一句回答…');s.finishing=new Promise(resolve=>s.resolve=resolve);s.timeout=setTimeout(()=>asrDone(s,'最后一句识别超时，已显示的文字保留，请核对后再次点击「回答完成」'),8000);try{s.ws.send(JSON.stringify({type:'end'}));}catch{asrDone(s,'识别连接已断开，已显示的文字保留');}return s.finishing;};
const asrSubmit=submitMeetAnswer;
submitMeetAnswer=async function(){if(CLOUD_ASR.submitting)return;CLOUD_ASR.submitting=true;try{if(!await meetStopListening())return;return await asrSubmit();}finally{CLOUD_ASR.submitting=false;}};
// Clearing or leaving must discard late results, rather than refill the next question.
const asrRenderShell=renderShell;renderShell=function(){asrAbort();return asrRenderShell();};
const asrExit=simpleExit;simpleExit=async function(){asrAbort();return asrExit();};
const asrExitInterview=exitInterview;exitInterview=function(){asrAbort();return asrExitInterview();};
document.addEventListener('click',e=>{if(e.target.closest('[data-action="meet-clear"]'))asrAbort();},true);
window.addEventListener('pagehide',asrAbort);
