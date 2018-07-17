AFRAME.registerComponent('beat-sync', {
  dependencies: ['resonance-audio-src'],

  multiple: true,

  schema: {
    target: {type: 'string', default: ''},
    refresh: {type: 'number', default: 10},
    event: {type: 'string', default: 'onbeat'}
  },

  init: function () {
    // Set up throttling.
    this.throttledFunction = AFRAME.utils.throttle(this.emitEvent, this.data.refresh, this);

    this.el.parentEl.addEventListener('loaded', this.postLoadInit.bind(this))
    this.src = this.el.getDOMAttribute('resonance-audio-src').src
    this.setUpTarget()
    this.beatIdx = 0

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

  postLoadInit () {
    this.el.parentEl.removeEventListener('loaded', this.postLoadInit.bind(this))


    this.room = this.el.parentEl.components['resonance-audio-room']
    this.resonanceAudioContext = this.room.resonanceAudioContext
    console.log(this.resonanceAudioContext);

    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof this.src !== 'string') { throw new TypeError('invalid src: Must be a string.') }
    if (!this.src.charAt(0) === '#') {
      throw new Error('must link to an audio element in assets using #id')
    }
    const audioEl = document.querySelector(this.src)
    if (!audioEl) { throw new Error('invalid src') }
    else {
      this.audioEl = audioEl
      if (!audioEl.beatData) {
        audioEl.beatData = "loading"
        if (this.resonanceAudioContext.state === "running") {
          this.resonanceAudioContext.suspend()
        }
        this.getBeats()
      }
    }
  },

  getBeats() {
    var self = this
    // Load some audio (CORS need to be allowed or we won't be able to decode the data)
    fetch(this.audioEl.getAttribute('src'), {mode: "cors"}).then(function(resp) {return resp.arrayBuffer()}).then(decode);

    // Decode the audio file, then start the show
    function decode(buffer) {
      // Loading....
      self.resonanceAudioContext.decodeAudioData(buffer, buildTempoData);
    }

    function buildTempoData(abuffer) {
      //Average 2 channels
      var audioArr = []
      if (abuffer.numberOfChannels == 2) {
        var channel1Data = abuffer.getChannelData(0);
        var channel2Data = abuffer.getChannelData(1);
        var length = channel1Data.length;
        for (var i = 0; i < length; i++) {
          audioArr[i] = (channel1Data[i] + channel2Data[i]) / 2;
        }
      } else {
        audioArr = buffer.getChannelData(0);
      }
      self.audioEl.beatData = new MusicTempo(audioArr);
      self.resonanceAudioContext.resume()
      console.log(self.audioEl.beatData);
    }
  },

  emitEvent () {
    if (this.resonanceAudioContext.state === "running" && this.audioEl.beatData && this.audioEl.beatData !== "loading") {
      //emit event preceding beat by threshold amount.  Account for audio processing latency.
      if (this.audioEl.beatData.beats[this.beatIdx] - this.audioEl.currentTime < .15) {
        this.target.emit(this.data.event)
        this.beatIdx ++
      }
    }
  },


  tick: function () {
    //reset when song starts
    if (this.audioEl.currentTime === 0) {
      this.beatIdx = 0
    }
    this.throttledFunction();  // Called once a second.
  }

})
