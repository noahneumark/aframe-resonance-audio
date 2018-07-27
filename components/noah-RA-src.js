AFRAME.registerComponent('resonance-audio-src', {
  dependencies: ['geometry', 'position'],

  multiple: false,

  schema: {
    src: {type: 'string', default: ''},
    channel: {type: 'string', default: 'both'},
    loop: {type: 'boolean', default: true},
    autoplay: {type: 'boolean', default: true},
    alpha: {type: 'number', default: 0},
		sharpness: {type: 'number', default: 1},
		gain: {type: 'number', default: 1},
		maxDistance: {type: 'number', default: 1000},
    sourceWidth: {type: 'number', default: 60},
    streamObject: {
      default: {},
      parse: function (value) {
        return value
      }
    }
  },

  init () {
    this.setMediaSrc = this.setMediaSrc.bind(this)
    this.setMediaStream = this.setMediaStream.bind(this)
    this.exposeAPI = this.exposeAPI.bind(this)
    this.disconnectPreviousSrc = this.disconnectPreviousSrc.bind(this)
    // this.setPosition = this.setPosition.bind(this)
    this.connectedSrc = {}
    this.connectedSrc.element = false
    this.connectedSrc.stream = false

    this.pos = new AFRAME.THREE.Vector3()
    this.el.parentEl.addEventListener('loaded', this.postLoadInit.bind(this))
    this.exposeAPI()
    this.initialPlay = true

    //check for Beat Sync
    const attrStartsWith = (prefix) => {
      return Array.from(document.querySelectorAll('*'))
      .filter((e) => Array.from(e.attributes).filter(
        ({name, value}) => name.startsWith(prefix)).length
      ) ? true : false
    }
    this.isBeatSync = attrStartsWith('beat-sync')
    this.throttledFunction = AFRAME.utils.throttle(this.setPosition, 40, this);
  },

  postLoadInit () {
    this.el.parentEl.removeEventListener('loaded', this.postLoadInit.bind(this))
    this.room = this.el.parentEl.components['resonance-audio-room']
    this.resonanceAudioScene = this.room.resonanceAudioScene
    this.resonanceAudioContext = this.room.resonanceAudioContext
    //run audioContext methods from here
    this.setMediaSrc (this.data.src)
  },

  update (oldData) {
    // Need to test update upon attribute changes.
    if (!this.initialPlay) {
      if (oldData.src !== this.data.src) {
        this.setMediaSrc(this.data.src)
      } else {
        this.setupSource()
      }
    }
  },

  exposeAPI () {
    const descriptor_src = {
      set: (value) => { this.setMediaSrc(value) },
      get: ()      => this.data.src
    }
    const descriptor_streamObject = {
      set: (value) => { this.setMediaStream(value) },
      get: ()      => this.data.streamObject
    }
    Object.defineProperty(this.el, 'src', descriptor_src)
    Object.defineProperty(this.el, 'srcObject', descriptor_streamObject)
    Object.defineProperty(this, 'src', descriptor_src)
    Object.defineProperty(this, 'srcObject', descriptor_streamObject)
  },

  setMediaSrc (src) {
    var self = this
    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof src !== 'string') { throw new TypeError('invalid src') }
    // For src connected to audio asset with #id reference
    if (src.charAt(0) === '#') {
      const el = document.querySelector(src)
      if (!el) { throw new Error('invalid src') }
      src = el.getAttribute('src')
      this.sourceNode = el
      this.connectElementSrc()
    } else {  // For instances with a local reference to audio path
      if (src === '' || typeof src == 'undefined') { return }
      fetch(src, {mode: "cors"}).then(function(resp) {return resp.arrayBuffer()})
      .then(function (buffer) {
        self.resonanceAudioContext.decodeAudioData(buffer, function (audioData) {
          self.sourceNode = self.resonanceAudioContext.createBufferSource()
          self.sourceNode.buffer = audioData;
          self.connectBufferSrc()
        })
      })
    }
    this.el.setAttribute('resonance-audio-src', {streamObject : null, src : src})

  },

  setMediaStream (mediaStream) {
    if (!(mediaStream instanceof MediaStream) && mediaStream != null) {
      throw new TypeError('not a mediastream')
    }
    this.el.setAttribute('resonance-audio-src', {streamObject : mediaStream, src : ''})
    this.room.connectStreamSrc(mediaStream)
  },

  disconnectPreviousSrc () {
    if (this.connectedSrc.buffer) {
      this.audioBufferSourceNode.disconnect(this.resonanceAudioSceneSource.input)
      delete this.audioBufferSourceNode
      this.connectedSrc.buffer = false
    }
    if (this.connectedSrc.element) {
      this.mediaElementAudioNode.disconnect(this.resonanceAudioSceneSource.input)
      delete this.mediaElementAudioNode
      this.connectedSrc.element = false
    }
    if (this.connectedSrc.stream) {
      this.mediaStreamAudioNode.disconnect(this.resonanceAudioSceneSource.input)
      delete this.mediaStreamAudioNode
      this.connectedSrc.stream = false
    }
  },

  connectBufferSrc() {
    this.disconnectPreviousSrc();
    if (!this.resonanceAudioSceneSource) {
      this.resonanceAudioSceneSource = this.resonanceAudioScene.createSource()
    }
    this.sourceNode.connect(this.resonanceAudioSceneSource.input)
    this.connectedSrc.buffer = true
    if (this.data.loop) {
      this.sourceNode.loop = true
    }
    this.setupSource()
  },

  connectElementSrc () {
    this.disconnectPreviousSrc();

    // Generate a GLOBAL Audio Node from the sourceNode element.
    if (!this.el.sceneEl.mediaElementAudioNode) {
      this.el.sceneEl.mediaElementAudioNode = this.resonanceAudioContext.createMediaElementSource(this.sourceNode)
      //Generate GLOBAL Splitter
      this.el.sceneEl.splitter = this.resonanceAudioContext.createChannelSplitter(2);
      //Connect Node to Splitter
      this.el.sceneEl.mediaElementAudioNode.connect(this.el.sceneEl.splitter)
    }
    // Make local reference to Node
    this.mediaElementAudioNode = this.el.sceneEl.mediaElementAudioNode

    // Make local reference to Splitter
    this.splitter = this.el.sceneEl.splitter

    //Generate LOCAL Merger
    this.merger = this.resonanceAudioContext.createChannelMerger();


    if (this.data.channel === 'both') {
      this.splitter.connect(this.merger, 0)
      this.splitter.connect(this.merger, 1)
    } else if (this.data.channel === 'left') {
      this.splitter.connect(this.merger, 0)
    } else {
      this.splitter.connect(this.merger, 1)
    }

    // Generate an input for the scene.
    if (!this.resonanceAudioSceneSource) {
      this.resonanceAudioSceneSource = this.resonanceAudioScene.createSource()
    }
    this.merger.connect(this.resonanceAudioSceneSource.input)
    // this.mediaElementAudioNode.connect(this.resonanceAudioSceneSource.input)
    this.connectedSrc.element = true
    // Looping
    if (this.data.loop) {
      this.sourceNode.setAttribute('loop', 'true')
    } else {
      this.sourceNode.removeAttribute('loop')
    }
    this.setupSource()
  },

  setupSource() {
    // Set directivity patterns
    this.resonanceAudioSceneSource.setDirectivityPattern(this.data.alpha, this.data.sharpness)

    // Set gainNode
    this.resonanceAudioSceneSource.setGain(this.data.gain)

    // Set max distance
    this.resonanceAudioSceneSource.setMaxDistance(this.data.maxDistance)

    // Set max distance
    this.resonanceAudioSceneSource.setSourceWidth(this.data.sourceWidth)

    if (this.data.autoplay && this.resonanceAudioContext.state === "running" && !this.isBeatSync) {
      this.playSound()
    }

  },

  playSound () {
    if (this.connectedSrc.element) {
      this.sourceNode.play()
      .catch(function (err) {
        console.log(err);
      })
    } else if (this.connectedSrc.buffer) {
      this.sourceNode.start()
    }
  },

  pauseSound () {
    if (this.sourceNode) {
      if (this.connectedSrc.element) {
        this.sourceNode.pause()
      } else if (this.connectedSrc.buffer) {
        this.sourceNode.stop()
      }
    }
  },

  play () {
    if (!this.data.autoplay && this.initialPlay) {
      this.initialPlay = false
      return
    } else if (this.resonanceAudioContext.state === "running" && !this.isBeatSync) {
      this.playSound()
    }
    if (this.initialPlay) {
      this.initialPlay = false
    }
  },

  pause () {
    this.pauseSound()
  },

  tick () {
    //runs setPosition throttled for better performance
    this.throttledFunction()
  },

  remove () {
    this.pauseSound()
    this.sourceNode = null
  },

  setPosition () {
    if (this.resonanceAudioSceneSource) { //Safe from asynch calls
      this.resonanceAudioSceneSource.setFromMatrix(this.el.object3D.matrixWorld)
    }
  },

})

AFRAME.registerPrimitive('a-resonance-audio-src', {
  defaultComponents: {
    'resonance-audio-src': {},
  },

  mappings: {
    src: 'resonance-audio-src.src',
    channel: 'resonance-audio-src.channel',
    loop: 'resonance-audio-src.loop',
    autoplay: 'resonance-audio-src.autoplay',
    alpha: 'resonance-audio-src.alpha',
		sharpness: 'resonance-audio-src.sharpness',
		gain: 'resonance-audio-src.gain',
		maxDistance: 'resonance-audio-src.maxDistance',
    sourceWidth: 'resonance-audio-src.sourceWidth',
    streamObject: 'resonance-audio-src.streamObject'
  }
})
