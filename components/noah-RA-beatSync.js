AFRAME.registerComponent('beat-sync', {
  dependencies: ['resonance-audio-src'],

  multiple: true,

  schema: {
    target: {type: 'string', default: ''},
    event: {type: 'string', default: 'onbeat'},
    frequency: {type: 'number', default: 1},
    pattern: {type: 'array', default: [1]},
    start: {type: 'int', default: 0},
    end: {type: 'int', default: null},
    src: {type: 'string', default: ''},
    refresh: {type: 'number', default: 30},
    threshold: {type: 'number', default: .13},
    debug: {type: 'boolean', default: false}
  },

  init: function () {
    this.audioContext = {}
    this.audioContext.state = 'loading'
    // Set up throttling.
    this.throttledFunction = AFRAME.utils.throttle(this.emitEvent, this.data.refresh, this);

    this.el.parentEl.addEventListener('loaded', this.postLoadInit.bind(this))

    this.sourceType = this.el.getDOMAttribute('resonance-audio-src') ?
      'resAudio' :
      this.el.getDOMAttribute('sound') ?
      'sound' :
      null

    this.src = this.sourceType === "resAudio" ?
      this.el.getDOMAttribute('resonance-audio-src').src :
      this.sourceType === "sound" ?
      this.el.getDOMAttribute('sound').src :
      null

    this.setUpTarget()
    this.beatIdx = 0
    this.patternIdx = 0
    this.beatDivisions = []
    if (!window.Worker) {
      console.error('beat-sync component not supported in this browser');
    }
  },

  tick: function () {
    this.throttledFunction();
  },

  update (oldData) {
  },

  setUpTarget () {
    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof this.data.target !== 'string') { throw new TypeError('invalid target: Must be a string.') }
    if (!this.src.charAt(0) === '#') {
      throw new Error('must link to an element using #id')
    }
    const targetEl = document.querySelector(this.data.target)
    if (!targetEl) { throw new Error('invalid target') }
    else {
      this.target = targetEl
    }
  },

  setUpSrc () {
    const beatSrc = this.data.src
    return new Promise((resolve, reject)=>{
      if (beatSrc === '') {resolve('loading')}
      else {
        // Simplified asset parsing, similar to the one used by A-Frame.
        if (typeof beatSrc !== 'string') { throw new TypeError('invalid src') }
        // fetch(beatSrc, {mode: "cors"}).then( resp => {console.log(resp);})
        this.room.el.emit('bufferloaded')
        function loadJSON(src, callback) {
          var xobj = new XMLHttpRequest();
          xobj.overrideMimeType("application/json");
          xobj.open('GET', src, true);
          xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
              callback(JSON.parse(xobj.response));
            }
          };
          xobj.send(null);
        }
        loadJSON(beatSrc, json => {
          this.room.el.emit('beatsready')
          this.playSound()
          resolve(json)
        })
      }
    })
  },

  postLoadInit () {
    this.el.parentEl.removeEventListener('loaded', this.postLoadInit.bind(this))

    this.room = this.el.parentEl.components['resonance-audio-room']
    this.audioContext = this.room ?
      this.room.resonanceAudioContext :
      THREE.AudioContext ?
      THREE.AudioContext.getContext() :
      null

    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof this.src !== 'string') { throw new TypeError('invalid src: Must be a string.') }
    if (!this.src.charAt(0) === '#') {
      throw new Error('must link to an audio element in assets using #id')
    }
    const audioEl = document.querySelector(this.src)
    if (!audioEl) { throw new Error('invalid src') }
    else {
      this.audioEl = audioEl
      //reset beat index whenever song starts playing
      const resetBeat = e => {
        this.beatIdx = 0
      }
      audioEl.addEventListener('playing', resetBeat.bind(this))
      if (!this.audioEl.beats) {
        this.audioEl.beats = "loading"
        this.setUpSrc().then(json=>{
          this.audioEl.beats = json
          if (window.Worker && this.audioEl.beats === "loading") {
            this.getBeats()
          }
        })
      }
    }
  },



  emitEvent () {
    if (this.audioEl) {
      if (this.audioContext.state === "running" && this.audioEl.beats && this.audioEl.beats !== "loading") {
        //Establish end beat if null or beyond length.
        if (!this.data.end || this.data.end > this.audioEl.beats.length - 1){
          this.data.end = this.audioEl.beats.length - 1
        }
        //Establish current time by source type (Sound component or ResonanceAudio component)
        let currentTime
        if (this.sourceType === "resAudio") {
          currentTime = this.audioEl.currentTime
        } else {
          currentTime = this.audioContext.currentTime - this.el.components.sound.pool.children[0].startTime
        }
        //correct course if current song time gets ahead of beat index
        if (currentTime > this.audioEl.beats[this.beatIdx]) {
          const findBeat = (beat, i) => {
            return (beat-currentTime < beat - this.audioEl.beats[i-1] && beat-currentTime > 0)
          }
          this.beatIdx = this.audioEl.beats.findIndex(findBeat)
        }
        //Set nextEmit time depending on frequency setting
        let nextEmit
        const patternVal = parseInt(this.data.pattern[this.patternIdx])
        if (this.data.frequency === 1) {
          nextEmit = this.audioEl.beats[this.beatIdx]
        } else if (this.data.frequency < 1) {
          if (this.beatIdx === 0) {
            nextEmit = this.audioEl.beats[0]
          } else {
            const findDivision = div => {
              return (currentTime < div)
            }
            nextEmit = this.beatDivisions.find(findDivision)
          }
        } else {
          if (this.beatIdx === 0) {
            nextEmit = this.audioEl.beats[0]
          } else {
            if (Math.abs(this.beatIdx-this.data.start)%this.data.frequency === 0){
              nextEmit = this.audioEl.beats[this.beatIdx]
            } else {
              nextEmit = 0
            }
          }
        }
        //emit event preceding next emit by threshold amount.  Account for audio processing latency. Skip if on offbeat.
        if (nextEmit - currentTime < this.data.threshold && nextEmit !== 0 && this.room.isUnlocked === true) {

          if (this.data.frequency < 1){
            this.beatDivisions.splice(0,1)
          }

          //skip emits with 0 from pattern and only within specified start and end points
          if (patternVal !== 0 && (this.audioEl.beats[this.data.start] - currentTime < this.data.threshold) && !(this.audioEl.beats[this.data.end] - currentTime < this.data.threshold)) {
            const event = this.data.event
            const data = {beatIdx: this.beatIdx, patternIdx: this.patternIdx, val: patternVal}
            this.target.emit(event, data)
          }
          this.patternInc()
        }
        //Increment beat index if within threshold of the beat.
        if (this.audioEl.beats[this.beatIdx] - currentTime < this.data.threshold) {
          this.beatInc(currentTime)
        }
      }
    }
  },

  patternInc () {
    //find next pattern index with Algo
    if (this.data.frequency < 1) {
      const nextDivNum = this.beatDivisions.length === 1 ? 1 : Math.floor(1/this.data.frequency) - this.beatDivisions.length
      const totalBeatDivs = Math.abs((this.beatIdx - this.data.start)*Math.floor(1/this.data.frequency))
      this.patternIdx = (totalBeatDivs + nextDivNum -1 )%this.data.pattern.length
    } else {
      this.patternIdx = ((this.beatIdx - this.data.start + 1)/this.data.frequency)%this.data.pattern.length
    }

    //loop through pattern on increment (old buggy method)
    // if (this.patternIdx === this.data.pattern.length -1) {
    //   this.patternIdx = 0
    // } else {
    //   this.patternIdx ++
    // }
  },

  beatInc (curTime) {
    if (this.data.debug){
      console.log(`Beat: ${this.beatIdx}, Time: ${curTime}`);
    }
    if (this.beatIdx === this.data.start && this.room.isUnlocked){
      if (this.data.debug){
        console.log(`${this.id} start ************************`);
      }
      this.target.emit('start')
    } else if (this.beatIdx === this.data.end){
      this.target.emit('end')
    }
    this.beatIdx ++
    if (this.data.frequency < 1) {
      //Set up current beat's beatDivisions array
      const curBeat = this.audioEl.beats[this.beatIdx]
      const prevBeat = this.audioEl.beats[this.beatIdx - 1]
      const interval = Math.abs(curBeat - prevBeat)
      const beatArray = []
      for (let i=0; i < Math.floor(1/this.data.frequency); i++){
        const newDiv = ((i+1)*this.data.frequency*interval) + prevBeat
        beatArray.push(newDiv)
      }
      this.beatDivisions = beatArray
    }
  },

  playSound() {
    if (this.sourceType === "resAudio") {
      if (this.room.isUnlocked){
        this.audioEl.play()
      }
    } else {
      if (this.room.isUnlocked){
        this.el.components.sound.playSound()
      }
    }
  },

  getBeats() {
    const preBuffer = performance.now()
    //Load buffer
    let request = new XMLHttpRequest();
        request.open('GET', this.audioEl.getAttribute('src'), true);
        request.responseType = 'arraybuffer'
    request.onload = () => {
      if (this.audioContext.state === "running") {
        this.sourceType === "resAudio" ?
          this.audioEl.pause() :
          this.el.components.sound.pauseSound();
      }
      //Decode the audio file, then pass to worker to process beat data
      this.audioContext.decodeAudioData(request.response, decBuffer =>{

        const worker = new Worker(URL.createObjectURL(new Blob([`(${workerFn})()`], {
          type: "text/javascript"
        })))

        //Prepare data into chunks
        const chData = decBuffer.getChannelData(0)
        const sampleRate = decBuffer.sampleRate
        decBuffer = undefined
        console.log(`Decode Processing Time: ${performance.now() - preBuffer}`);
        const timeDelta = performance.now() - preBuffer
        this.room.el.emit('bufferloaded', {timeDelta: timeDelta})
        //Set number of divisions as inversely proportional to decode audio time
        const divisions = Math.floor((chData.length)/((168*Math.pow(10,8))/timeDelta)) || 1

        const size = Math.floor(chData.length/divisions)
        const chunkDur = (chData.length/divisions)/sampleRate
        let slicesArray = []
        for (let i=0; i < divisions; i ++) {
          const sliced = chData.slice(i*size, (i+1) * size)
          slicesArray.push(sliced)
        }

        let callIdx = 0
        let chunkPos = 0

        //Recursively build beatsArray from chunks
        const sendToWorker = () => {
          //base case
          if (callIdx === divisions){
            if (divisions === 1){
              this.room.el.emit('beatsready')
              this.playSound()
            }
            worker.terminate()
            console.log(JSON.stringify(this.audioEl.beats));
            console.log(`Beat Processing Time: ${performance.now()-preBeat}`);
            return
          } else {
            //recursion
            worker.postMessage(slicesArray[callIdx].buffer, [slicesArray[callIdx].buffer])
            worker.onmessage = e => {
              if (callIdx > 0) {
                //Start playing as soon as there is beat data
                if (callIdx === 1) {
                  this.room.el.emit('beatsready')
                  this.playSound()
                }
                this.audioEl.beats = [...this.audioEl.beats, ...e.data.beats.map(beat => {
                  return beat + chunkPos
                })];

              } else {
                this.audioEl.beats = e.data.beats
              }
              callIdx++
              chunkPos += chunkDur
              sendToWorker()
            }
          }
        }
        const preBeat = performance.now()
        sendToWorker()
      })
    }
    request.send()

  }

})

const workerFn = function () {
  this.onmessage = function (e) {
    const beatPromise = new Promise ((resolve, reject) => {
      resolve(new MusicTempo(new Float32Array(e.data)))
    })
    beatPromise.then(beatData => {
      this.postMessage({beats: beatData.beats})
    })
  }
  //Music Tempo code from https://killercrush.github.io/music-tempo/docs/class/src/MusicTempo.js~MusicTempo.html
  !function(e,t){if("function"==typeof define&&define.amd)define(["module","exports"],t);else if("undefined"!=typeof exports)t(module,exports);else{var r={exports:{}};t(r,r.exports),e.FFT=r.exports}}(this,function(e,t){"use strict";function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),a=function(){function e(){r(this,e)}return n(e,null,[{key:"getHammingWindow",value:function(e){for(var t=1/e/.54,r=Math.sqrt(e),n=2*Math.PI/e,a=[],o=0;o<e;o++)a[o]=r*(t*(25/46-21/46*Math.cos(n*o)));return a}},{key:"getSpectrum",value:function(e,t){var r=e.length,n=Math.round(Math.log(r)/Math.log(2)),a=2*Math.PI;if(r!=1<<n)throw new Error("FFT data must be power of 2");for(var o=void 0,i=0,s=0;s<r-1;s++){if(s<i){var l=e[i];e[i]=e[s],e[s]=l,l=t[i],t[i]=t[s],t[s]=l}for(var f=r/2;f>=1&&f-1<i;)i-=f,f/=2;i+=f}for(var u=1;u<=n;u++){o=1<<u;var c=1,h=0,v=a/o,d=Math.cos(v),p=-1*Math.sin(v),m=o/2;for(i=0;i<m;i++){for(var g=i;g<r;g+=o){var y=g+m,b=c*e[y]-h*t[y],x=c*t[y]+h*e[y];e[y]=e[g]-b,t[y]=t[g]-x,e[g]+=b,t[g]+=x}var w=c;c=d*c-p*h,h=d*h+p*w}}for(var I=0;I<e.length;I++){var M=e[I]*e[I]+t[I]*t[I];e[I]=M}for(var T=0;T<e.length;T++)e[T]=Math.sqrt(e[T])}}]),e}();t.default=a,e.exports=t.default}),function(e,t){if("function"==typeof define&&define.amd)define(["module","exports"],t);else if("undefined"!=typeof exports)t(module,exports);else{var r={exports:{}};t(r,r.exports),e.OnsetDetection=r.exports}}(this,function(e,t){"use strict";function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),a=function(){function e(){r(this,e)}return n(e,null,[{key:"calculateSF",value:function(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};if(void 0===t)throw new ReferenceError("fft is undefined");if("function"!=typeof t.getHammingWindow||"function"!=typeof t.getSpectrum)throw new ReferenceError("fft doesn't contain getHammingWindow or getSpectrum methods");Array.prototype.fill||(Array.prototype.fill=function(e){if(null==this)throw new TypeError("this is null or not defined");for(var t=Object(this),r=t.length>>>0,n=arguments[1],a=n>>0,o=a<0?Math.max(r+a,0):Math.min(a,r),i=arguments[2],s=void 0===i?r:i>>0,l=s<0?Math.max(r+s,0):Math.min(s,r);o<l;)t[o]=e,o++;return t}),r.bufferSize=r.bufferSize||2048,r.hopSize=r.hopSize||441;var n=r.bufferSize,a=r.hopSize,o=Math.floor(Math.log(n)/Math.LN2);if(Math.pow(2,o)!==n)throw"Invalid buffer size ("+n+"), must be power of 2";var i=t.getHammingWindow(n),s=[],l=n/2+1,f=new Array(l);f.fill(0);var u=new Array(n),c=e.length,h=new Array(n-a);h.fill(0),e=h.concat(e);var v=new Array(n-e.length%a);v.fill(0),e=e.concat(v);for(var d=0;d<c;d+=a){for(var p=d+n,m=[],g=0,y=d;y<p;y++)m[g]=i[g]*e[y],g++;u.fill(0),t.getSpectrum(m,u);for(var b=0,x=0;x<l;x++){var w=m[x]-f[x];b+=w<0?0:w}s.push(b),f=m}return s}},{key:"normalize",value:function(e){if(!Array.isArray(e))throw"Array expected";if(0==e.length)throw"Array is empty";for(var t=0,r=0,n=0;n<e.length;n++)t+=e[n],r+=e[n]*e[n];var a=t/e.length,o=Math.sqrt((r-t*a)/e.length);0==o&&(o=1);for(var i=0;i<e.length;i++)e[i]=(e[i]-a)/o}},{key:"findPeaks",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=e.length,n=e,a=t.decayRate||.84,o=t.peakFindingWindow||6,i=t.meanWndMultiplier||3,s=t.peakThreshold||.35,l=n[0],f=[],u=0;u<r;u++)if(l=a*l+(1-a)*n[u],!(n[u]<l)){var c=u-o,h=u+o+1;c<0&&(c=0),h>r&&(h=r),l<n[u]&&(l=n[u]);for(var v=!0,d=c;d<h;d++)n[d]>n[u]&&(v=!1);if(v){var p=u-o*i,m=u+o;p<0&&(p=0),m>r&&(m=r);for(var g=0,y=m-p,b=p;b<m;b++)g+=n[b];n[u]>g/y+s&&f.push(u)}}if(f.length<2)throw"Fail to find peaks";return f}}]),e}();t.default=a,e.exports=t.default}),function(e,t){if("function"==typeof define&&define.amd)define(["module","exports"],t);else if("undefined"!=typeof exports)t(module,exports);else{var r={exports:{}};t(r,r.exports),e.TempoInduction=r.exports}}(this,function(e,t){"use strict";function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),a=function(){function e(){r(this,e)}return n(e,null,[{key:"processRhythmicEvents",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=t.widthTreshold||.025,n=t.maxIOI||2.5,a=t.minIOI||.07,o=e.length,i=[],s=[],l=0,f=0;f<o-1;f++)for(var u=f+1;u<o;u++){var c=e[u]-e[f];if(!(c<a)){if(c>n)break;for(var h=0;h<l;h++)if(Math.abs(i[h]-c)<r){Math.abs(i[h+1]-c)<Math.abs(i[h]-c)&&h<l-1&&h++,i[h]=(i[h]*s[h]+c)/(s[h]+1),s[h]++;break}if(h==l){for(l++;h>0&&i[h-1]>c;h--)i[h]=i[h-1],s[h]=s[h-1];i[h]=c,s[h]=1}}}if(0==l)throw"Fail to find IOIs";return i.length=l,s.length=l,{clIntervals:i,clSizes:s}}},{key:"mergeClusters",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=t.widthTreshold||.025,n=e.clIntervals,a=e.clSizes,o=n.length,i=0;i<o;i++)for(var s=i+1;s<o;s++)if(Math.abs(n[i]-n[s])<r){n[i]=(n[i]*a[i]+n[s]*a[s])/(a[i]+a[s]),a[i]=a[i]+a[s],--o;for(var l=s+1;l<=o;l++)n[l-1]=n[l],a[l-1]=a[l]}return n.length=o,a.length=o,{clIntervals:n,clSizes:a}}},{key:"calculateScore",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=t.widthTreshold||.025,n=t.maxTempos||10,a=e.clIntervals,o=e.clSizes,i=[],s=[],l=a.length,f=0;f<l;f++)i[f]=10*o[f],s[f]={score:i[f],idx:f};if(s.sort(function(e,t){return t.score-e.score}),s.length>n){for(var u=n-1;u<s.length-1&&s[u].score==s[u+1].score;u++)n++;s.length=n}s=s.map(function(e){return e.idx});for(var c=0;c<l;c++)for(var h=c+1;h<l;h++){var v=a[c]/a[h],d=v<1,p=void 0,m=void 0;if(!((p=d?Math.round(1/v):Math.round(v))<2||p>8)){m=d?Math.abs(a[c]*p-a[h]):Math.abs(a[c]-a[h]*p);var g=d?r:r*p;m>=g||(p=p>=5?1:6-p,i[c]+=p*o[h],i[h]+=p*o[c])}}return{clScores:i,clScoresIdxs:s}}},{key:"createTempoList",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=t.widthTreshold||.025,n=t.minBeatInterval||.3,a=t.maxBeatInterval||1,o=e.clIntervals,i=(e.clSizes,e.clScores),s=e.clScoresIdxs,l=[],f=o.length,u=0;u<s.length;u++){for(var c=s[u],h=o[c]*i[c],v=i[c],d=void 0,p=void 0,m=0;m<f;m++)if(m!=c){var g=o[c]/o[m],y=g<1,b=y?Math.round(1/g):Math.round(g);b<2||b>8||(y?(d=Math.abs(o[c]*b-o[m]),p=r):(d=Math.abs(o[c]-b*o[m]),p=r*b),d>=p||(h+=y?o[m]/b*i[m]:o[m]*b*i[m],v+=i[m]))}for(var x=h/v;x<n;)x*=2;for(;x>a;)x/=2;l.push(x)}return l}}]),e}();t.default=a,e.exports=t.default}),function(e,t){if("function"==typeof define&&define.amd)define(["module","exports"],t);else if("undefined"!=typeof exports)t(module,exports);else{var r={exports:{}};t(r,r.exports),e.Agent=r.exports}}(this,function(e,t){"use strict";function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var n=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),a=function(){function e(t,n,a,o){var i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:{};r(this,e),this.expiryTime=i.expiryTime||10,this.toleranceWndInner=i.toleranceWndInner||.04,this.toleranceWndPre=i.toleranceWndPre||.15,this.toleranceWndPost=i.toleranceWndPost||.3,this.toleranceWndPre*=t,this.toleranceWndPost*=t,this.correctionFactor=i.correctionFactor||50,this.maxChange=i.maxChange||.2,this.penaltyFactor=i.penaltyFactor||.5,this.beatInterval=t,this.initialBeatInterval=t,this.beatTime=n,this.totalBeatCount=1,this.events=[n],this.score=a,this.agentListRef=o}return n(e,[{key:"considerEvent",value:function(e,t){if(e-this.events[this.events.length-1]>this.expiryTime)return this.score=-1,!1;var r=Math.round((e-this.beatTime)/this.beatInterval),n=e-this.beatTime-r*this.beatInterval;return r>0&&n>=-this.toleranceWndPre&&n<=this.toleranceWndPost&&(Math.abs(n)>this.toleranceWndInner&&this.agentListRef.push(this.clone()),this.acceptEvent(e,t,n,r),!0)}},{key:"acceptEvent",value:function(e,t,r,n){this.beatTime=e,this.events.push(e);var a=r/this.correctionFactor;Math.abs(this.initialBeatInterval-this.beatInterval-a)<this.maxChange*this.initialBeatInterval&&(this.beatInterval+=a),this.totalBeatCount+=n;var o=r>0?r/this.toleranceWndPost:r/-this.toleranceWndPre,i=1-this.penaltyFactor*o;this.score+=t*i}},{key:"fillBeats",value:function(){var e=void 0,t=void 0,r=void 0,n=void 0;e=0,this.events.length>2&&(e=this.events[0]);for(var a=0;a<this.events.length;a++){t=this.events[a],n=Math.round((t-e)/this.beatInterval-.01),r=(t-e)/n;for(var o=0;n>1;n--)e+=r,this.events.splice(a+o,0,e),o++;e=t}}},{key:"clone",value:function(){var t=new e;return t.beatInterval=this.beatInterval,t.initialBeatInterval=this.initialBeatInterval,t.beatTime=this.beatTime,t.totalBeatCount=this.totalBeatCount,t.events=this.events.slice(),t.expiryTime=this.expiryTime,t.toleranceWndInner=this.toleranceWndInner,t.toleranceWndPre=this.toleranceWndPre,t.toleranceWndPost=this.toleranceWndPost,t.correctionFactor=this.correctionFactor,t.maxChange=this.maxChange,t.penaltyFactor=this.penaltyFactor,t.score=this.score,t.agentListRef=this.agentListRef,t}}]),e}();t.default=a,e.exports=t.default}),function(e,t){if("function"==typeof define&&define.amd)define(["module","exports","./Agent"],t);else if("undefined"!=typeof exports)t(module,exports,require("./Agent"));else{var r={exports:{}};t(r,r.exports,e.Agent),e.BeatTracking=r.exports}}(this,function(e,t,r){"use strict";function n(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var a=function(e){return e&&e.__esModule?e:{default:e}}(r),o=function(){function e(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}return function(t,r,n){return r&&e(t.prototype,r),n&&e(t,n),t}}(),i=function(){function e(){n(this,e)}return o(e,null,[{key:"trackBeat",value:function(e,t,r){function n(){f.sort(function(e,t){return e.beatInterval-t.beatInterval});for(var e=f.length,t=0;t<e;t++)if(!(f[t].score<0))for(var r=t+1;r<e&&!(f[r].beatInterval-f[t].beatInterval>s);r++)Math.abs(f[r].beatTime-f[t].beatTime)>l||(f[t].score<f[r].score?f[t].score=-1:f[r].score=-1);for(var n=e-1;n>=0;n--)f[n].score<0&&f.splice(n,1)}for(var o=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},i=o.initPeriod||5,s=o.thresholdBI||.02,l=o.thresholdBT||.04,f=[],u=0;u<r.length;u++)f.push(new a.default(r[u],e[0],t[0],f,o));var c=1;for(n();e[c]<i;){for(var h=f.length,v=-1,d=!0,p=0;p<h;p++)f[p].beatInterval!=v&&(d||f.push(new a.default(v,e[c],t[c],f,o)),v=f[p].beatInterval,d=!1),d=f[p].considerEvent(e[c],t[c])||d;n(),c++}for(var m=e.length,g=c;g<m;g++){for(var y=f.length,b=0;b<y;b++)f[b].considerEvent(e[g],t[g]);n()}return f}}]),e}();t.default=i,e.exports=t.default}),function(e,t){if("function"==typeof define&&define.amd)define(["module","exports","./OnsetDetection","./TempoInduction","./BeatTracking","./FFT"],t);else if("undefined"!=typeof exports)t(module,exports,require("./OnsetDetection"),require("./TempoInduction"),require("./BeatTracking"),require("./FFT"));else{var r={exports:{}};t(r,r.exports,e.OnsetDetection,e.TempoInduction,e.BeatTracking,e.FFT),e.MusicTempo=r.exports}}(this,function(e,t,r,n,a,o){"use strict";function i(e){return e&&e.__esModule?e:{default:e}}function s(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(t,"__esModule",{value:!0});var l=i(r),f=i(n),u=i(a),c=i(o),h=function e(t){var r=this,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(s(this,e),t instanceof Float32Array)Array.from||(Array.from=function(){var e=Object.prototype.toString,t=function(t){return"function"==typeof t||"[object Function]"===e.call(t)},r=function(e){var t=Number(e);return isNaN(t)?0:0!==t&&isFinite(t)?(t>0?1:-1)*Math.floor(Math.abs(t)):t},n=Math.pow(2,53)-1,a=function(e){var t=r(e);return Math.min(Math.max(t,0),n)};return function(e){var r=this,n=Object(e);if(null==e)throw new TypeError("Array.from requires an array-like object - not null or undefined");var o,i=arguments.length>1?arguments[1]:void 0;if(void 0!==i){if(!t(i))throw new TypeError("Array.from: when provided, the second argument must be a function");arguments.length>2&&(o=arguments[2])}for(var s,l=a(n.length),f=t(r)?Object(new r(l)):new Array(l),u=0;u<l;)s=n[u],f[u]=i?void 0===o?i(s,u):i.call(o,s,u):s,u+=1;return f.length=l,f}}()),t=Array.from(t);else if(!Array.isArray(t))throw"audioData is not an array";var a=n.timeStep||.01,o=l.default.calculateSF(t,c.default,n);this.spectralFlux=o,l.default.normalize(this.spectralFlux),this.peaks=l.default.findPeaks(this.spectralFlux,n),this.events=this.peaks.map(function(e){return e*a});var i=f.default.processRhythmicEvents(this.events,n);i=f.default.mergeClusters(i,n);var h=f.default.calculateScore(i,n);i={clIntervals:i.clIntervals,clSizes:i.clSizes,clScores:h.clScores,clScoresIdxs:h.clScoresIdxs},this.tempoList=f.default.createTempoList(i,n);var v=this.spectralFlux.reduce(function(e,t){return Math.min(e,t)}),d=this.peaks.map(function(e){return r.spectralFlux[e]-v});this.agents=u.default.trackBeat(this.events,d,this.tempoList,n);var p=-1,m=-1;this.tempo=-1,this.beats=[],this.beatInterval=-1;for(var g=0;g<this.agents.length;g++)this.agents[g].score>p&&(p=this.agents[g].score,m=g);if(this.agents[m]&&(this.bestAgent=this.agents[m],this.bestAgent.fillBeats(),this.tempo=(60/this.bestAgent.beatInterval).toFixed(3),this.beatInterval=this.bestAgent.beatInterval,this.beats=this.bestAgent.events),-1==this.tempo)throw"Tempo extraction failed"};t.default=h,e.exports=t.default});
}
