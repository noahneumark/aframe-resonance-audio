AFRAME.registerComponent('resonance-audio-src', {
  dependencies: ['geometry', 'position'],

  multiple: false,

  schema: {
    src: {type: 'asset', default: ''},
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
    this.setPosition = this.setPosition.bind(this)
    this.connectedSrc = {}
    this.connectedSrc.element = false
    this.connectedSrc.stream = false

    this.pos = new AFRAME.THREE.Vector3()
    this.el.parentEl.addEventListener('loaded', this.postLoadInit.bind(this))
    this.exposeAPI()
    this.initialPlay = true
  },

  postLoadInit () {
    this.el.parentEl.removeEventListener('loaded', this.postLoadInit.bind(this))
    this.room = this.el.parentEl.components['resonance-audio-room']
    this.resonanceAudioScene = this.room.resonanceAudioScene
    this.resonanceAudioContext = this.room.resonanceAudioContext
    //run audioContext methods from here
    this.setMediaSrc (this.data.src)
  },

  update () {
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
    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof src !== 'string') { throw new TypeError('invalid src') }
    // For src connected to audio asset with #id reference
    if (src.charAt(0) === '#') {
      const el = document.querySelector(src)
      if (!el) { throw new Error('invalid src') }
      src = el.getAttribute('src')
      this.sourceNode = el
    } else {  // For instances with a local reference to audio path
      this.el.audioElement = document.createElement('audio')
      // Don't connect a new element if it's left empty.
      if (src === '' || typeof src == 'undefined') { return }
      // Load an audio file into the AudioElement.
      this.el.audioElement.setAttribute('src', src)
      this.sourceNode = this.el.audioElement
    }
    this.el.setAttribute('resonance-audio-src', {streamObject : null, src : src})

    this.connectElementSrc()
  },

  setMediaStream (mediaStream) {
    if (!(mediaStream instanceof MediaStream) && mediaStream != null) {
      throw new TypeError('not a mediastream')
    }
    this.el.setAttribute('resonance-audio-src', {streamObject : mediaStream, src : ''})
    this.room.connectStreamSrc(mediaStream)
  },

  disconnectPreviousSrc () {
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

  connectElementSrc () {
    this.disconnectPreviousSrc();

    // Generate an Audio Node from the sourceNode element.
    if (!this.mediaElementAudioNode) {
      this.mediaElementAudioNode = this.resonanceAudioContext.createMediaElementSource(this.sourceNode)
    }
    // Generate an input for the scene.
    if (!this.resonanceAudioSceneSource) {
      this.resonanceAudioSceneSource = this.resonanceAudioScene.createSource()
    }
    this.mediaElementAudioNode.connect(this.resonanceAudioSceneSource.input)
    this.connectedSrc.element = true

    // Set directivity patterns
    this.resonanceAudioSceneSource.setDirectivityPattern(this.data.alpha, this.data.sharpness)

    // Set gainNode
    this.resonanceAudioSceneSource.setGain(this.data.gain)

    // Set max distance
    this.resonanceAudioSceneSource.setMaxDistance(this.data.maxDistance)

    // Set max distance
    this.resonanceAudioSceneSource.setSourceWidth(this.data.sourceWidth)

    // Looping
    if (this.data.loop) {
      this.sourceNode.setAttribute('loop', 'true')
    } else {
      this.sourceNode.removeAttribute('loop')
    }

    // Play the audio.
    if (this.data.autoplay && this.resonanceAudioContext.state === "running") {
      this.playSound()
    } else if (this.data.autoplay && AFRAME.utils.device.isIOS()) {
      console.log('Account for iOS audioContext suspend state and autoplay');
    } else if (!this.data.autoplay && this.resonanceAudioContext.state === "running") {
      this.pauseSound()
    }

  },

  playSound () {
    this.sourceNode.play()
    .catch(function (err) {
      console.log(err);
    })
  },

  pauseSound () {
    if (this.sourceNode) {
      this.sourceNode.pause()
    }
  },

  play () {
    if (this.initialPlay) {
      this.initialPlay = false
    }
    if (!this.data.autoplay) {
      return
    } else if (this.resonanceAudioContext.state === "running") {
      this.playSound()
    }
  },

  pause () {
    this.pauseSound()
  },

  tick() {
    this.setPosition()
  },

  remove () {
    this.sourceNode.pause()
    this.sourceNode = null
  },

  setPosition () {
    this.resonanceAudioSceneSource.setFromMatrix(this.el.object3D.matrixWorld)
  },

})
