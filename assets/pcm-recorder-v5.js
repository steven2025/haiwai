/* Downsample mono input to 16 kHz PCM, emitting exactly 40 ms per frame. */
class InterviewPCM extends AudioWorkletProcessor{
 constructor(){super();this.frame=new Int16Array(640);this.pos=0;this.sum=0;this.count=0;this.phase=0;}
 process(inputs){const data=inputs[0]?.[0];if(!data)return true;for(const value of data){this.sum+=value;this.count++;this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;const v=Math.max(-1,Math.min(1,this.sum/this.count));this.frame[this.pos++]=Math.round(v*(v<0?32768:32767));this.sum=0;this.count=0;if(this.pos===640){const buf=new ArrayBuffer(1280),view=new DataView(buf);for(let i=0;i<640;i++)view.setInt16(i*2,this.frame[i],true);this.port.postMessage(buf,[buf]);this.pos=0;}}}return true;}
}
registerProcessor('interview-pcm',InterviewPCM);
