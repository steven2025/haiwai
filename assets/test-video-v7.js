/* Candidate-specific remote test video; no interview state or media permissions required. */
function mountTestVideoButton(){
 if(!SIMPLE.auth||examiner()||SIMPLE.profile?.id!=='practice-th-student')return;
 const links=document.querySelector('.compact-profile .dossier-links');
 if(links&&!links.querySelector('[data-action="candidate-test-video"]'))links.insertAdjacentHTML('afterbegin','<button class="btn btn-ghost btn-sm" data-action="candidate-test-video"><span aria-hidden="true">▶</span> 测试视频</button>');
}
const testVideoShell=renderShell;
renderShell=function(){testVideoShell();mountTestVideoButton();};
mountTestVideoButton();
function openCandidateTestVideo(){
 if(document.getElementById('candidate-test-player'))return;
 const previous=document.activeElement,controller=new AbortController(),signal=controller.signal;
 const dialog=document.createElement('dialog');dialog.id='candidate-test-player';dialog.className='test-video-window';
 dialog.setAttribute('aria-labelledby','test-video-title');
 dialog.innerHTML=`<div class="test-video-content" id="candidate-test-fullscreen"><header class="test-video-titlebar" tabindex="0" aria-label="拖动移动窗口，也可使用方向键"><h2 id="test-video-title">测试视频</h2><div class="test-video-tools"><button type="button" data-video="smaller" aria-label="缩小视频窗口" title="缩小">−</button><button type="button" data-video="larger" aria-label="放大视频窗口" title="放大">＋</button><button type="button" data-video="fullscreen" aria-label="全屏播放">全屏</button><button type="button" data-video="close" aria-label="关闭测试视频">✕</button></div></header><div class="test-video-body"><video controls playsinline preload="metadata" aria-label="测试视频播放器" src="https://haiwai1-1311686407.cos.ap-guangzhou.myqcloud.com/thai.mp4"></video></div><footer><span class="test-video-status" role="status">拖动标题栏移动 · 右下角拖动缩放</span><button class="test-video-resize" type="button" aria-label="拖动调整视频窗口大小，也可使用方向键" title="拖动缩放">◢</button></footer></div>`;
 document.body.appendChild(dialog);
 const fullscreenTarget=dialog.querySelector('.test-video-content'),video=dialog.querySelector('video'),status=dialog.querySelector('.test-video-status'),bar=dialog.querySelector('header'),handle=dialog.querySelector('.test-video-resize');
 let box={x:0,y:0,w:Math.min(960,innerWidth-24),h:Math.min(640,innerHeight-24)},gesture=null,closed=false;
 box.x=(innerWidth-box.w)/2;box.y=(innerHeight-box.h)/2;
 function fit(){const maxW=Math.max(1,innerWidth-16),maxH=Math.max(1,innerHeight-16);box.w=Math.max(Math.min(300,maxW),Math.min(box.w,maxW));box.h=Math.max(Math.min(230,maxH),Math.min(box.h,maxH));box.x=Math.max(8,Math.min(box.x,innerWidth-box.w-8));box.y=Math.max(8,Math.min(box.y,innerHeight-box.h-8));Object.assign(dialog.style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});}
 function scale(factor){if(document.fullscreenElement===fullscreenTarget)return;const w=box.w,h=box.h;box.w*=factor;box.h*=factor;box.x-=(box.w-w)/2;box.y-=(box.h-h)/2;fit();}
 function close(){if(closed)return;closed=true;video.pause();video.removeAttribute('src');video.load();if(document.fullscreenElement===fullscreenTarget||document.fullscreenElement===video)document.exitFullscreen?.().catch(()=>{});controller.abort();dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();},{signal});
 dialog.addEventListener('close',close,{signal});
 dialog.addEventListener('click',async e=>{const button=e.target.closest('[data-video]');if(!button)return;switch(button.dataset.video){case 'close':close();break;case 'smaller':scale(.85);break;case 'larger':scale(1.15);break;case 'fullscreen':try{if(document.fullscreenElement===fullscreenTarget)await document.exitFullscreen();else if(fullscreenTarget.requestFullscreen)await fullscreenTarget.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();else throw Error();}catch{status.textContent='浏览器未允许全屏，可使用播放器自带全屏按钮';}break;}},{signal});
 function down(e,kind){if(e.button!==0||document.fullscreenElement===fullscreenTarget||kind==='move'&&e.target.closest('button'))return;e.preventDefault();gesture={kind,x:e.clientX,y:e.clientY,box:{...box},id:e.pointerId,target:e.currentTarget};e.currentTarget.setPointerCapture(e.pointerId);}
 bar.addEventListener('pointerdown',e=>down(e,'move'),{signal});handle.addEventListener('pointerdown',e=>down(e,'resize'),{signal});
 dialog.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;box={...gesture.box};if(gesture.kind==='move'){box.x+=dx;box.y+=dy;}else{box.w+=dx;box.h+=dy;}fit();},{signal});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])dialog.addEventListener(event,()=>{gesture=null;},{signal});
 for(const [target,kind] of [[bar,'move'],[handle,'resize']])target.addEventListener('keydown',e=>{if(e.target!==target||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||document.fullscreenElement===fullscreenTarget)return;e.preventDefault();const dx=e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0,dy=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0;if(kind==='move'){box.x+=dx;box.y+=dy;}else{box.w+=dx;box.h+=dy;}fit();},{signal});
 window.addEventListener('resize',fit,{signal});
 document.addEventListener('fullscreenchange',()=>{const full=document.fullscreenElement===fullscreenTarget,b=dialog.querySelector('[data-video="fullscreen"]');b.textContent=full?'退出全屏':'全屏';b.setAttribute('aria-label',b.textContent);dialog.querySelectorAll('[data-video="smaller"],[data-video="larger"]').forEach(x=>x.disabled=full);if(!full)fit();},{signal});
 video.addEventListener('error',()=>{status.textContent='视频暂时无法加载，请检查网络后关闭并重试';},{signal});
 window.addEventListener('pagehide',close,{signal});fit();dialog.showModal();
 video.play().catch(()=>{if(!closed)status.textContent='点击视频播放键开始 · 标题栏可拖动，右下角可缩放';});
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action="candidate-test-video"]'))openCandidateTestVideo();});
