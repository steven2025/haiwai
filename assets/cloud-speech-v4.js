/* AI question audio comes from TRTC TextToSpeech, with no browser voice fallback. */
const CLOUD_SPEECH={tickets:new Map(),serial:0,player:null,url:null,cache:new Map(),bytes:0};
function cloudSpeechKey(text){return String(text||'').trim();}
const cloudAnalysisCall=analysisCall;
analysisCall=async function(path,body){const d=await cloudAnalysisCall(path,body);if(path==='questions')for(const q of d.questions||[])if(q.speechTicket)CLOUD_SPEECH.tickets.set(cloudSpeechKey(q.question),q.speechTicket);if(path==='followup'&&d.speechTicket)CLOUD_SPEECH.tickets.set(cloudSpeechKey(d.question),d.speechTicket);return d;};
function cloudSpeechStatus(message,retry=false){const host=$('.simple-ai-language');if(!host)return;let row=$('#cloud-voice-state');if(!row){row=document.createElement('div');row.id='cloud-voice-state';row.setAttribute('role','status');row.style.cssText='width:100%;font-size:12px;line-height:1.8';host.append(row);}row.textContent=message;if(retry){const b=document.createElement('button');b.className='btn btn-ghost btn-sm';b.dataset.action='cloud-speech-play';b.textContent='点击播放语音';row.append(' ',b);}}
const cloudCancelSpeech=cancelSpeech;
cancelSpeech=function(){CLOUD_SPEECH.serial++;if(CLOUD_SPEECH.player){CLOUD_SPEECH.player.pause();CLOUD_SPEECH.player.onended=null;CLOUD_SPEECH.player.onerror=null;CLOUD_SPEECH.player=null;}if(CLOUD_SPEECH.url){URL.revokeObjectURL(CLOUD_SPEECH.url);CLOUD_SPEECH.url=null;}cloudCancelSpeech();if(typeof particleState==='function')particleState('listening');};
const cloudBrowserSpeak=speakText;
speakText=function(text,locale='zh-CN',opts={}){
 if(!SIMPLE.activeAI||ANALYSIS.mode!=='ai')return cloudBrowserSpeak(text,locale,opts);
 cancelSpeech();const serial=CLOUD_SPEECH.serial;
 if(!text||!S.settings.voice){cloudSpeechStatus('语音已关闭；可阅读问题后作答');opts.onDone?.();return;}
 const key=cloudSpeechKey(text),speechTicket=CLOUD_SPEECH.tickets.get(key),language=interviewLanguages.ai.interviewer;
 cloudSpeechStatus('正在准备'+flowLanguage(language)+'云端语音…');particleState('thinking');
 return (async()=>{try{
  if(!speechTicket)throw Error('当前问题缺少云端语音凭证，请更新云函数后重新开始本场面试');
  let d=CLOUD_SPEECH.cache.get(speechTicket);
  if(!d){d=await rtcRequest('speech/synthesize',{speechTicket});if(serial!==CLOUD_SPEECH.serial)return;if(d.provider!=='trtc'||d.language!==language||d.mime!=='audio/mpeg')throw Error('云端返回的语音语言或格式不一致，已停止播放');if(CLOUD_SPEECH.bytes+d.audio.length>10000000){CLOUD_SPEECH.cache.clear();CLOUD_SPEECH.bytes=0;}CLOUD_SPEECH.cache.set(speechTicket,d);CLOUD_SPEECH.bytes+=d.audio.length;}
  if(serial!==CLOUD_SPEECH.serial)return;
  const raw=atob(d.audio),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));CLOUD_SPEECH.url=URL.createObjectURL(new Blob([bytes],{type:d.mime}));
  const audio=new Audio(CLOUD_SPEECH.url);CLOUD_SPEECH.player=audio;
  audio.onplaying=()=>{if(serial!==CLOUD_SPEECH.serial)return;cloudSpeechStatus('正在播放：腾讯云语音 · '+flowLanguage(d.language));particleState('speaking');opts.onSentence?.(0,text);};
  audio.onended=()=>{if(serial!==CLOUD_SPEECH.serial)return;particleState('listening');cloudSpeechStatus('腾讯云语音 · '+flowLanguage(d.language)+' · 已播完');opts.onDone?.();};
  audio.onerror=()=>{if(serial!==CLOUD_SPEECH.serial)return;particleState('listening');cloudSpeechStatus('云端音频播放失败；可点击下方重播，或继续文字作答');opts.onDone?.();};
  try{await audio.play();}catch(e){if(serial!==CLOUD_SPEECH.serial)return;if(e.name==='NotAllowedError'){particleState('listening');cloudSpeechStatus('浏览器需要你点击后才能播放云端语音',true);}else throw e;}
 }catch(e){if(serial!==CLOUD_SPEECH.serial)return;particleState('listening');const message=/Unknown.*endpoint/i.test(e.message)?'云端语音接口尚未部署，请更新 v4.1 云函数':e.message;cloudSpeechStatus('语音暂不可用：'+message+'。可继续文字作答。');showToast('云端语音未播放：'+e.message,'warn');opts.onDone?.();}})();
};
document.addEventListener('click',async e=>{if(!e.target.closest('[data-action="cloud-speech-play"]'))return;try{await CLOUD_SPEECH.player?.play();}catch{cloudSpeechStatus('播放未成功，请检查浏览器声音权限后重试',true);}});
const cloudSimpleExit=simpleExit;simpleExit=async function(){cancelSpeech();CLOUD_SPEECH.tickets.clear();CLOUD_SPEECH.cache.clear();CLOUD_SPEECH.bytes=0;return cloudSimpleExit();};
