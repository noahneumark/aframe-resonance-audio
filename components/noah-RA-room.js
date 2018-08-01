/* global AFRAME AudioContext */
// let roomObj
// const log = AFRAME.utils.debug
// const warn = log('components:resonance-audio-room:warn')

const RESONANCE_MATERIAL = Object.keys(ResonanceAudio.Utils.ROOM_MATERIAL_COEFFICIENTS)

AFRAME.registerComponent('resonance-audio-room', {
  dependencies: ['geometry', 'position'],

  multiple: false,

  schema: {
    width: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.width},
    height: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.height},
    depth: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.depth},
    ambisonicOrder: {type: 'int', default: ResonanceAudio.Utils.DEFAULT_AMBISONIC_ORDER, oneOf: [1, 3]},
    speedOfSound: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_SPEED_OF_SOUND},
    left: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    right: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    front: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    back: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    down: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    up: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    src: {type: 'string', default: ''},
    loop: {type: 'boolean', default: true},
    autoplay: {type: 'boolean', default: true},
    gain: {type: 'number', default: 1}
  },

  init : function () {
    //binding methods
    this.roomSetup = this.roomSetup.bind(this)
    this.handleLockedResume = this.handleLockedResume.bind(this)
    this.handleLockedPlay = this.handleLockedPlay.bind(this)
    this.connectBuffer = this.connectBuffer.bind(this)

    this.throttledFunction = AFRAME.utils.throttle(this.setListener, 50, this);
    this.isUnlocked = false
    var sceneEl = this.el.sceneEl
    this.builtInGeometry = true
    this.cameraMatrix4 = new AFRAME.THREE.Matrix4()
    this.resonanceAudioContext = new AudioContext({latencyHint:"playback", sampleRate: 22100})
    this.resonanceAudioScene = new ResonanceAudio(this.resonanceAudioContext)
    this.resonanceAudioScene.output.connect(this.resonanceAudioContext.destination)

    //check for Beat Sync
    const checkForBeatSyncComp = (prefix) => {
      const beatsyncEl = Array.from(document.querySelectorAll('*'))
      .filter((e) => Array.from(e.attributes).filter(
        ({name, value}) => name.startsWith(prefix)).length
      )[0]
      if (beatsyncEl){
        const beatSrc = Object.keys(beatsyncEl.components).find(attr => {
          return attr.startsWith(prefix)
        })
        if (beatSrc) {return false}
        else {return true}
      } else {return false}
    }
    this.isBeatWait = checkForBeatSyncComp('beat-sync')
    if (this.isBeatWait) {
      this.handleWaitForBeats()
    } else {
      this.clickUnlock()
    }
  },

  update : function (oldData){
    this.roomSetup()
    if (this.data.src && this.data.src !== oldData.src) {
      this.setAmbisonicSource(this.data.src)
    }
  },

  tick () {
    this.throttledFunction()

  },

  // update resonanceAudioScene after room is tocked
  tock () {

  },

  setListener () {
    const cameraEl = this.el.sceneEl.camera.el
    this.cameraMatrix4 = cameraEl.object3D.matrixWorld
    this.resonanceAudioScene.setListenerFromMatrix(this.cameraMatrix4)
  },

  // room setup
  roomSetup () {
    // room dimensions
    let dimensions = {
      width: this.data.width,
      height: this.data.height,
      depth: this.data.depth
    }
    if ((this.data.width + this.data.height + this.data.depth) === 0) {
      const bb = new AFRAME.THREE.Box3().setFromObject(this.el.object3D)
      dimensions.width = bb.getSize().x
      dimensions.height = bb.getSize().y
      dimensions.depth = bb.getSize().z
      this.builtInGeometry = false
    }
    // update geometry (only if using default geometry)
    if (this.builtInGeometry) {
      this.el.setAttribute('geometry', dimensions)
    }
    // room materials
    let materials = {
      left: this.data.left,
      right: this.data.right,
      front: this.data.front,
      back: this.data.back,
      down: this.data.down,
      up: this.data.up
    }
    this.resonanceAudioScene.setRoomProperties(dimensions, materials)

    this.setPosition()
  },

  disconnectPreviousSrc () {
    if (this.connectedSrc) {
      this.ambisonicSourceNode.disconnect(this.resonanceAudioScene.ambisonicInput)
      delete this.ambisonicSourceNode
      this.connectedSrc = false
    }
  },

  setAmbisonicSource (src) {
    this.disconnectPreviousSrc()
    var self = this
    // Simplified asset parsing, similar to the one used by A-Frame.
    if (typeof src !== 'string') { throw new TypeError('invalid src') }
    // For src connected to audio asset with #id reference
    if (src.charAt(0) === '#') {
      const el = document.querySelector(src)
      if (!el) { throw new Error('invalid src') }
      src = el.getAttribute('src')
      this.data.src = src
    }
    if (src === '' || typeof src == 'undefined') { return }
    fetch(src, {mode: "cors"}).then(function(resp) {return resp.arrayBuffer()})
    .then(function (buffer) {
      self.resonanceAudioContext.decodeAudioData(buffer, function (audioData) {
        self.bufferNode = self.resonanceAudioContext.createBufferSource()
        self.bufferNode.buffer = audioData;
        self.connectBuffer()
      })
    })
    .catch((err)=>{console.log(err);})

  },

  connectBuffer() {
    //Create 4 channel splitter
    this.splitter = this.resonanceAudioContext.createChannelSplitter(4);
    //Connect bufferNode to splitter
    this.bufferNode.connect(this.splitter)
    //Create merger as ambisonicSourceNode
    this.ambisonicSourceNode = this.resonanceAudioContext.createChannelMerger()
    //Connect splitter to ambisonicSourceNode
    this.splitter.connect(this.ambisonicSourceNode, 0, 0)
    this.splitter.connect(this.ambisonicSourceNode, 1, 1)
    this.splitter.connect(this.ambisonicSourceNode, 2, 2)
    this.splitter.connect(this.ambisonicSourceNode, 3, 3)

    //Setup ambisonicInput to receive source
    this.resonanceAudioScene.ambisonicInput.channelInterpretation = "discrete"
    this.resonanceAudioScene.ambisonicInput.channelCountMode = "clamped-max"
    this.resonanceAudioScene.ambisonicInput.channelCount = 4

    //Connect ambisonicSourceNode to ambisonicInput
    this.ambisonicSourceNode.connect(this.resonanceAudioScene.ambisonicInput)

    this.resonanceAudioScene.ambisonicInput.gain.value = this.data.gain

    if (this.data.loop) {
      this.bufferNode.loop = true
    }
    if (this.data.autoplay && this.resonanceAudioContext.state === "running") {
      this.playSound()
    }
    this.connectedSrc = true
  },

  playSound() {
    this.bufferNode.start()
  },

  setPosition () {
    this.el.object3D.updateMatrixWorld()
  },

  handleWaitForBeats () {
    const self = this
    const camera = document.querySelector('[camera]')
    const waitForBeat = document.createElement('a-entity')
    const bufferLoaded = function (e) {
      self.el.removeEventListener('bufferloaded', bufferLoaded)
      const beatsReady = () => {
        self.el.removeEventListener('beatsready', beatsReady)
        camera.removeChild(waitForBeat)
        self.clickUnlock()
      }
      self.el.addEventListener('beatsready', beatsReady)

    }
    waitForBeat.setAttribute('text', {
      value: 'Waiting for Beat Data...',
      geometry: 'plane',
      align: 'center',
      color: 'red'
    })
    waitForBeat.object3D.position.set(0, 0.1, -.7)
    self.el.addEventListener('bufferloaded', bufferLoaded)
    camera.appendChild(waitForBeat)

  },

  clickUnlock () {
    //Add click functionality for audio-locked devices
    let isDesktop = false
    if (!AFRAME.utils.device.isMobile() && !AFRAME.utils.device.checkHeadsetConnected()) {
      isDesktop = true
      this.startEvent = "keypress"
      this.endEvent = "keypress"
    } else {
      this.startEvent = "touchstart"
      this.endEvent = "touchend"
    }

    //add click instructions
    var clickForAudioEl = document.createElement('a-entity')
    clickForAudioEl.setAttribute('text', {
      value: isDesktop ? 'Press Any Key' : 'Click for Audio',
      geometry: 'plane',
      align: 'center',
      color: 'red'
    })
    clickForAudioEl.object3D.position.set(0, 0.1, -.7)
    this.clickForAudioEl = clickForAudioEl
    var camera = document.querySelector('[camera]')
    camera.appendChild(clickForAudioEl)
    //initiate and unlock audio
    document.body.addEventListener(this.startEvent, this.handleLockedResume)
    document.body.addEventListener(this.endEvent, this.handleLockedPlay)
  },

  handleLockedResume () {
    document.body.removeEventListener(this.startEvent, this.handleLockedResume)
    var camera = document.querySelector('[camera]')
    camera.removeChild(this.clickForAudioEl)
    this.clickForAudioEl = undefined
    const cxt = this.resonanceAudioContext
    cxt.resume()
    this.isUnlocked = true
  },

  handleLockedPlay () {
    document.body.removeEventListener(this.endEvent, this.handleLockedPlay)
    if (this.connectedSrc) {
      this.playSound()
    }
    const children = this.el.getChildren()
    children.forEach(function (child, i) {
      const components = child.components
      if (components.hasOwnProperty('resonance-audio-src')) {
        if (components['resonance-audio-src'].data.autoplay) {
          components['resonance-audio-src'].playSound()
        }
      }
    })
    document.addEventListener('keydown', this.toggleSound.bind(this))
  },

  toggleSound (e) {
    const cxt = this.resonanceAudioContext
    if (e.which === 32){
      if (cxt.state === "suspended") {
        cxt.resume()
      } else {
        cxt.suspend()
      }
    }
  }

})

AFRAME.registerPrimitive('a-resonance-audio-room', {
  defaultComponents: {
    'resonance-audio-room': {},
  },

  mappings: {
    width: 'resonance-audio-room.width',
    height: 'resonance-audio-room.height',
    depth: 'resonance-audio-room.depth',
    'ambisonic-order': 'resonance-audio-room.ambisonicOrder',
    'speed-of-sound': 'resonance-audio-room.speedOfSound',
    left: 'resonance-audio-room.left',
    right: 'resonance-audio-room.right',
    front: 'resonance-audio-room.front',
    back: 'resonance-audio-room.back',
    down: 'resonance-audio-room.down',
    up: 'resonance-audio-room.up',
    src: 'resonance-audio-room.src',
    loop: 'resonance-audio-room.loop',
    autoplay: 'resonance-audio-room.autoplay',
    gain: 'resonance-audio-room.gain'
  }
})
