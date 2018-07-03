// var debugLib = require('debug');
// var extend = require('object-assign');

function bind (fn, ctx/* , arg1, arg2 */) {
  return (function (prependedArgs) {
    return function bound () {
      // Concat the bound function arguments with those passed to original bind
      var args = prependedArgs.concat(Array.prototype.slice.call(arguments, 0));
      return fn.apply(ctx, args);
    };
  })(Array.prototype.slice.call(arguments, 2));
};



// var console.log = debug('components:sound:console.log');

AFRAME.registerComponent('convolution', {
  schema: {
    autoplay: {default: false},
    distanceModel: {default: 'inverse', oneOf: ['linear', 'inverse', 'exponential']},
    loop: {default: false},
    maxDistance: {default: 10000},
    on: {default: ''},
    poolSize: {default: 1},
    positional: {default: true},
    refDistance: {default: 1},
    rolloffFactor: {default: 1},
    src: {type: 'audio'},
    impulse: {type: 'audio'},
    volume: {default: 1}
  },

  multiple: true,

  init: function () {
    this.listener = null;
    this.audioLoader = new THREE.AudioLoader();
    this.pool = new THREE.Group();
    this.loaded = false;
    this.mustPlay = false;
    this.playSound = bind(this.playSound, this);
    this.sourcePool = [];
    this.dryPool = [];
    this.wetPool = [];
    this.directionVec3 = new THREE.Vector3();
    this.distance = null;
  },

  update: function (oldData) {
    var data = this.data;



    var srcChanged = data.src !== oldData.src;
    // Create new sound if not yet created or changing `src`.
    if (srcChanged) {
      if (!data.src) {
        console.log('Audio source was not specified with `src`');
        return;
      }
      this.setupSound();
    }

    var sourcePool = this.sourcePool
    var pool = this.pool
    pool.children.forEach(function (sound, i) {
      if (data.positional) {
        sound.setDistanceModel(data.distanceModel);
        sound.setMaxDistance(data.maxDistance);
        sound.setRefDistance(data.refDistance);
        sound.setRolloffFactor(data.rolloffFactor);
      }
      sourcePool[i].loop = data.loop
      sound.setVolume(data.volume);
      sound.isPaused = false;
    });

    if (data.on !== oldData.on) {
      this.updateEventListener(oldData.on);
    }

    // All sound values set. Load in `src`.
    if (srcChanged) {
      var self = this;

      this.loaded = false;
      this.audioLoader.load(data.src, function (buffer) {
        self.sourcePool.forEach(function (sound) {
          sound.buffer = buffer
        });
        self.loaded = true;

        // Remove this key from cache, otherwise we can't play it again
        THREE.Cache.remove(data.src);
        if (self.data.autoplay || self.mustPlay) { self.playSound(); }
        self.el.emit('sound-loaded', self.evtDetail);
      });
    }
  },

  tick: function (time, timeDelta) {
    //Crossfade wet/dry values
    var directionVec3 = this.directionVec3;
    var objectPos = this.el.object3D.position;
    var cameraPos = document.querySelector('a-camera').object3D.position;
    directionVec3.copy(objectPos).sub(cameraPos);
    this.distance = directionVec3.length();
    this.crossfade(this.distance)
  },

  pause: function () {
    this.stopSound();
    this.removeEventListener();
  },

  play: function () {
    if (this.data.autoplay) { this.playSound(); }
    this.updateEventListener();
  },

  remove: function () {
    this.removeEventListener();
    this.el.removeObject3D(this.attrName);
    try {
      this.pool.children.forEach(function (sound) {
        sound.disconnect();
      });
    } catch (e) {
      // disconnect() will throw if it was never connected initially.
      console.log('Audio source not properly disconnected');
    }
  },

  /**
  *  Update listener attached to the user defined on event.
  */
  updateEventListener: function (oldEvt) {
    var el = this.el;
    if (oldEvt) { el.removeEventListener(oldEvt, this.playSound); }
    el.addEventListener(this.data.on, this.playSound);
  },

  removeEventListener: function () {
    this.el.removeEventListener(this.data.on, this.playSound);
  },

  /**
   * Removes current sound object, creates new sound object, adds to entity.
   *
   * @returns {object} sound
   */
  setupSound: function () {
    var self = this;
    var el = this.el;
    var sceneEl = el.sceneEl;

    if (this.pool.children.length > 0) {
      this.stopSound();
      el.removeObject3D('sound');
    }

    // Only want one AudioListener. Cache it on the scene.
    var listener = this.listener = sceneEl.audioListener || new THREE.AudioListener();
    sceneEl.audioListener = listener;

    if (sceneEl.camera) {
      sceneEl.camera.add(listener);
    }

    // Wait for camera if necessary.
    sceneEl.addEventListener('camera-set-active', function (evt) {
      evt.detail.cameraEl.getObject3D('camera').add(listener);
    });

    // Create [poolSize] audio instances and attach them to pool
    this.pool = new THREE.Group();
    var pool = this.pool;
    var sourcePool = this.sourcePool;
    var audioLoader = this.audioLoader
    var data = this.data
    for (var i = 0; i < this.data.poolSize; i++) {
      // var sound = this.data.positional ? new THREE.PositionalAudio(listener) : new THREE.Audio(listener);
      var soundSource = listener.context.createBufferSource();
      var sound = new THREE.PositionalAudio(listener)
      var impulse = new THREE.Audio(listener)
      sourcePool[i] = soundSource
      soundSource.loop = data.loop
      audioLoader.load(data.impulse, function (buffer) {
        impulse.setBuffer(buffer);
        var conv = listener.context.createConvolver();
        var copy = Object.assign(impulse.buffer)
        conv.buffer = copy
        conv.normalize = true
        soundSource.connect(conv)
        sound.setNodeSource(conv)
        pool.add(sound);
        el.setObject3D(this.attrName, pool);
      })
    }

    // Emit 'sound ended' event
    this.pool.children.forEach(function (sound, i) {
      sound.onEnded = function () {
        sound.isPlaying = false;
        el.emit('sound-ended', self.evtDetail);
      };
    });
  },

  /**
   * Pause all the sounds in the pool.
   */
  pauseSound: function () {
    this.isPlaying = false;
    this.sourcePool.forEach(function (sound) {
      if (!sound.source || !sound.source.buffer || !sound.isPlaying || sound.isPaused) { return; }
      sound.isPaused = true;
      sound.pause();
    });
  },

  /**
   * Look for an unused sound in the pool and play it if found.
   */
  playSound: function () {
    var pool = this.pool
    if (!this.loaded) {
      console.log('Sound not loaded yet. It will be played once it finished loading');
      this.mustPlay = true;
      return;
    }

    var found = false;
    this.isPlaying = true;
    this.sourcePool.forEach(function (sound, i) {
      var poolSound = pool.children[i]
      if (!sound.isPlaying && sound.buffer && !found) {
        sound.start();
        poolSound.isPaused = false;
        found = true;
        return;
      }
    });

    if (!found) {
      console.log('All the sounds are playing. If you need to play more sounds simultaneously ' +
           'consider increasing the size of pool with the `poolSize` attribute.', this.el);
      return;
    }

    this.mustPlay = false;
  },

  /**
   * Stop all the sounds in the pool.
   */
  stopSound: function () {
    this.isPlaying = false;
    this.sourcePool.forEach(function (sound) {
      if (!sound.source || !sound.source.buffer) { return; }
      sound.stop();
    });
  },

  crossfade: function(currentDistance) {
    var data = this.data
    var x = parseInt(currentDistance) / parseInt(data.maxDistance);
    // Use an equal-power crossfading curve:
    var gain1 = Math.cos(x * 0.5*Math.PI);
    var gain2 = Math.cos((1.0 - x) * 0.5*Math.PI);
    // this.ctl1.gainNode.gain.value = gain1;
    // this.ctl2.gainNode.gain.value = gain2;
  }


});
