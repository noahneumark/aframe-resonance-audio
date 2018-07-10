/* global AFRAME AudioContext */

const log = AFRAME.utils.debug
const warn = log('components:resonance-audio-room:warn')

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
    up: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL}
  },

  init : function () {
    //binding methods
    this.roomSetup = this.roomSetup.bind(this)
    this.handleIOSResume = this.handleIOSResume.bind(this)
    this.handleIOSPlay = this.handleIOSPlay.bind(this)

    this.builtInGeometry = true
    this.cameraMatrix4 = new AFRAME.THREE.Matrix4()
    this.resonanceAudioContext = new AudioContext()
    this.resonanceAudioScene = new ResonanceAudio(this.resonanceAudioContext)
    this.resonanceAudioScene.output.connect(this.resonanceAudioContext.destination)
    if (AFRAME.utils.device.isIOS()){
      document.body.addEventListener('touchstart', this.handleIOSResume)
      document.body.addEventListener('touchend', this.handleIOSPlay)
    }
    console.log(this.resonanceAudioContext.state);

  },

  update : function (oldData){
    this.roomSetup()
  },

  tick () {
    const cameraEl = this.el.sceneEl.camera.el
    this.cameraMatrix4 = cameraEl.object3D.matrixWorld
  },

  // update resonanceAudioScene after room is tocked
  tock () {
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

  setPosition () {
    this.el.object3D.updateMatrixWorld()
  },

  handleIOSResume () {
    const cxt = this.resonanceAudioContext
    console.log(cxt)
    cxt.resume()
    .then(function () {
      console.log(cxt);
    })
  },

  handleIOSPlay () {
    const children = this.el.getChildren()
    children.forEach(function (child, i) {
      const components = child.components
      if (components.hasOwnProperty('resonance-audio-src')) {
        if (components['resonance-audio-src'].data.autoplay) {
          components['resonance-audio-src'].playSound()
        }
      }
    })
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
    up: 'resonance-audio-room.up'
  }
})
