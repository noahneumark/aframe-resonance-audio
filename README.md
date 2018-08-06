# A-Frame Resonance Audio / Beat Kit
#### [👁 Live Demo 👁](https://noahneumark.github.io/aframe-resonance-audio/) - Best with headphones (work in progress)
Create realistic sonic VR environments using Aframe's WebVR tools and Google's Resonance Audio engine (Omnitone).  Integrate beat-syncing with a music source to trigger animations in time with music.

[A-Frame](https://aframe.io)  
[ResonanceAudio](https://developers.google.com/resonance-audio/) - A great video intro to this project is [here](https://www.youtube.com/watch?v=Na4DYI-WjlI&t=1185s).   
[Music-Tempo](https://github.com/killercrush/music-tempo)



## Components Included

* **resonance-audio-room** - A wrapper entity that defines the space that contains the sound source.
* **resonance-audio-src** - An audio source within the room that emulates a realistic sound source with spatial attributes.
* **beat-sync** - Integrate with a `resonance-audio-src` to trigger beat sychronized events.  Can target animations on any entity in the scene.
* **more to come...**

## Features

version 0.2.4

* **Beat sync music** with VR animations. Can be set to analyze beat data on load (expensive), or can include optional JSON file with beat data (preferred in most cases).
* **Sequencing capability**. Each beat sync instance supports variable frequency relative to beat (fractions or multiples), pattern loops, and start/end time.
* **Unlock audio support.**  Click screen unlocks the audio to account for Safari's (and now Chrome's) restrictive policy on autoplay.
* **Ambisonic** (spherical 3d) audio support for 4 channel 1st order source files.
* **Loop and autoplay.**
* **Room options** allow changing materials, and dimensions.
* **Sound source** options include directivity patterns, gain control, maximum distance, autoplay, loop, and selection of audio channel (from a stereo source). Multiple independent sources within a room.
* **Instantiate multiple instances** of the same audio source. You can separate a source by 'left' or 'right' channel.
* **Option for seamless loops.**

## Documentation
### Installation
```html
<head>
  <!-- ...meta/title... -->

  <script src="https://aframe.io/releases/0.8.2/aframe.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/resonance-audio/build/resonance-audio.min.js"></script>

  <!-- for beat sync animations include-->
  <script src="https://rawgit.com/ngokevin/kframe/master/components/animation/dist/aframe-animation-component.min.js"></script>

  <script src="https://cdn.rawgit.com/noahneumark/aframe-resonance-audio/fe37437/components/noah-ra-room.min.js"></script>
  <script src="https://cdn.rawgit.com/noahneumark/aframe-resonance-audio/fe37437/components/noah-ra-src.min.js"></script>
  <script src="https://cdn.rawgit.com/noahneumark/aframe-resonance-audio/fe37437/components/noah-ra-beatsync.min.js"></script>

</head>
```
### Create a Basic Scene
In this scene, we have two audio sources that reference the same stereo audio file loaded in the assests tag, each using a separate channel.  They are contained in a room  that mimics an outdoor space.  The entity with id `#songL` is the beat-sync source and gets beat data from the file `beats.json`.  This component targets itself and `#songR` sending trigger events to each entity's animation component.

```html
<a-scene>
	<a-assets>
		<audio id="song" src="assets/audio/mysong.mp3">
	</a-assets>

	<a-resonance-audio-room id="room"
	width="50" height="50" depth="50"
	left="transparent" right="transparent"
	front="transparent" back="transparent"
	down="grass" up="transparent">

		<a-entity id="songL"
		position="-2.5 1.2 -2.5"
		beat-sync__rotL="target:#songL; event:rotateL;
		frequency: 2; src: beats.json"
		beat-sync__rotR="target:#songR; event:rotateR;"
		animation="property: rotation; dur: 60; from: 0 45 0;
		to: 0 35 0; startEvents: rotateL"
		resonance-audio-src="src:#song; channel:left; alpha:0.5;
		sharpness: 2; gain: 2; maxDistance: 40;"></a-entity>

		<a-entity id="songR"
		position="2.5 1.2 -2.5"
		animation="property: rotation; dur: 90; from: 0 -45 0;
		to: 0 -35 0; startEvents: rotateR"
		resonance-audio-src="src:#song; channel:right; alpha:0.5;
		sharpness: 2; gain: 2; maxDistance: 40;"></a-entity>

	</a-resonance-audio-room>
</a-scene>
```

##  Components
### `resonance-audio-room`
All properties are optional.  Can be a used as a component on an `<a-entity>` like:  

```html
<a-entity resonance-audio-room="width:50; height:50; depth:50"></a-entity>
```
or as a primitive `<a-resonance-audio-room>`:

```html
<a-resonance-audio-room width="50" height="50" depth="50"></a-resonance-audio-room>
```

### Properties
| Property | Description | Default value |
| -------- | ----------- | ------------- |
| `width`    | Width of the audio room (in meters). | 0
| `height`   | Height of the audio room (in meters). | 0
| `depth`    | Depth of the audio room (in meters). | 0
| `ambisonicOrder` | [Ambisonic order](https://www.youtube.com/watch?v=C0xRAf9-XeU) of the audio room. | 1
| `speedOfSound` | Speed of sound within the audio room (in meters per second). | 343
| `left`     | Material of the left room wall.  | `transparent` |
| `right`     | Material of the right room wall.  | `transparent ` |
| `front`     | Material of the front room wall.  | `transparent ` |
| `back`     | Material of the back room wall.  | `transparent ` |
| `down`     | Material of the room floor.  | `transparent ` |
| `up`     | Material of the room ceiling.  | `transparent ` |
| `src` | Path to ambisonic 4 channel audio file. Can be a self contained path, or reference the id of an item loaded in `<a-assets>`.| *empty* |
| `loop` | If an ambisonic input is included, set a loop option. | `true` |
| `autoplay` | Set autoplay on load for ambisonic audio. | `true` |
| `gain` | Set the gain level for ambisonic audio. | 1 |

### Supported Wall Materials
Each material setting has a different pre-defined frequency-dependent absorption coefficient designated by the [Resonance Audio code](https://github.com/resonance-audio/resonance-audio-web-sdk/blob/master/src/utils.js#L260).

* `transparent`
* `acoustic-ceiling-tiles`
* `brick-bare`
* `brick-painted`
* `concrete-block-coarse`
* `concrete-block-painted`
* `curtain-heavy`
* `fiber-glass-insulation`
* `glass-thin`
* `glass-thick`
* `grass`
* `linoleum-on-concrete`
* `marble`
* `metal`
* `parquet-on-concrete`
* `plaster-smooth`
* `plywood-panel`
* `polished-concrete-or-tile`
* `sheetrock`
* `water-or-ice-surface`
* `wood-ceiling`
* `wood-panel`
* `uniform`

***

### `resonance-audio-src`
Defines the spatial source for the audio.  Must be a child of a `resonance-audio-room` instance.  All properties are optional except for `src`.  Can be a used as a component on an `<a-entity>` like:  

```html
<a-entity resonance-audio-src="src: #song; gain: .5"></a-entity>
```
or as a primitive `<a-resonance-audio-src>`:

```html
<a-resonance-audio-src src="#song" gain=".5"></a-resonance-audio-src>
```
### Properties

| Property | Description | Default value |
| -------- | ----------- | ------------- |
| `src` *(Required)*| Points to the audio source. Enter either an #*id* string pointing to a  `<audio>` or `<video>` set in the `<assets>` (preferable in most cases); or provide a path to a resource. If you provide a path, the audio will load as a buffer which is more resource intensive, but ideal for short seamless loops.  Multiple entities can point to the same  `<audio>` asset.| *empty* |
| `loop` | Set a loop option. | `true` |
| `autoplay` | Set autoplay on load. | `true` |
| `alpha` | Set the shape of the sound's directivity pattern. Between 0 and 1, where 0 is omnidirectional, .5 is cardioid, and 1 is a bidirectional pattern. | 0 |
| `sharpness` | Set the sharpness of the directivity pattern. Sharpness increases exponentially. | 1 |  
| `gain`| Set the gain level. | 1 |
| `maxDistance` | The maximum distance in meters.  Note: Beyond this distance you can still hear reflections. | 1000 |
| `sourceWidth` | The width of the source in degrees, where 0 degrees is a point source and 360 degrees is an omnidirectional source. | 60 |

***

### `beat-sync`
Include this component with a `resonance-audio-src` instance, and it emits events to a designated target element in sync with the musical beats of its audio source.  One intended application is to target animation components and designate `startEvents`, but any application that responds to events is possible. Multiple instances of `beat-sync` can be used on a single `resonance-audio-src` with different configurations, but if you have multiple `resonance-audio-src` instances referencing the same `<audio>` element, then the `beat-sync` instances **MUST** be on only one of them.

### Properties

| Property | Description | Default value |
| -------- | ----------- | ------------- |
| `target` *required* | Designate the element upon which to trigger the events. Enter an #*id* string. | *empty* |
| `event` | Name the event to send to the target.  If sending multiple events to the same element, you need to provide unique names.  Otherwise, you can just use the default `onbeat` event. | `onbeat` |
| `frequency` | Enter a multiple or fraction of a beat. By default, the component sends events on every beat.  Multiples can only be integers at this time. | 1 |
| `pattern` | Create a rhythmic pattern using a series of numbers that the component will cycle through relative to the specified frequency. For example `1, 0, 1, 1`, would skip every second event trigger of a 4 trigger pattern.  The value data gets sent through the event, and any number can be used for *on* events, but `0` is reserved for *off* events. | 1 |
| `start` | Designate the number of the starting beat (starting at 0). Events will not fire until it reaches this beat.  A `start` event will also fire at this point. | 0
| `end` | Designate the number of the ending beat (starting at 0). Events will not fire after it reaches this beat.  An `end` event will also fire at this point. | *The last beat* |
| `src` | Instead of using the default beat finding algorithm on load, you can designate the path to a JSON file that contains with beat data. Beat data should be an array of beat times (in seconds) using float values.  If the containing `resonance-audio-src` has multiple instances of `beat-sync`, this `src` must be included in the first instance if used. | *empty* |
| `refresh` | Adjust the scan rate of the code in milliseconds. Throttling is used so it doesn't run on every frame refresh. | 30 |
| `threshold` | Adjust the threshold proximity to the next event trigger event in seconds.  There is a sweet spot.  If too short relative to refresh rate, some events may get skipped.  If too long, events will fire too early. | .13    

By default, `beat-sync` uses a beat-finding algorithm on load of the scene, but it is a CPU intensive process for front-end code.  As an alternative, you can provide a JSON file with beat data.  If it is accurate, you can log the beat data from the algorithm, and bake it into a JSON file (or use it as a starting point).  Or my preferred method is to use a simple algorithm for calculating straight beats. If done correctly, this is the most precise method. It only works on music that was produced and quantized on a computer, and has no tempo changes. With tempo changes, you could still use it but you would have to run it in tempo segments.  For this algorithm, you will need some basic audio application where you can view precision time data to get end and start beats.  You will also need to count the total beats in the song.

```javascript
//You can use this code to get an array of beats if you song is a consistent tempo and computer quantized.

const endBeat = 146.23 //Time at the last beat (not the end of the song)
const startBeat = .052
const totalBeats = 240

const songLength = endBeat - startBeat
const beatLength = songLength/(totalBeats - 1)

let beats = []

for (let i = 0; i < totalBeats; i++) {
  beats.push((i*beatLength) + startBeat)
}

console.log(JSON.stringify(beats)); //copy this output and save into a json file
```

## Notes
* Older devices have trouble processing many audio tracks at a time. Ambisonic audio is an intense live rendering process, so if you're designing for compatibility in mind, you will have to limit number of audio sources, or keep files uncompressed.
* Processing beat data on the fly is a processor intensive algorithm.  I have optimized it as best as I can for front end purposes, and a slow device will start playing as soon as there is some data, but it may experience glitches until it finishes.  Also, this algorithm is more accurate on faster machines, as it doesn't need to process the audio in chunks.
* Have not yet tested media streaming, although there is some implementation in this version carried over from forking.
* Have not yet tested live updating of sound attributes.
* There is limited documentation from Google on directivity patterns, so I'm unclear exactly how those properties are affecting the sound, and it's relation with object orientation.


***

**Credits:**

<sub>**Inspired by A-Frame Resonance Audio component by Etienne Pinchon**</sub>  
<sup>Initial work from this project [etiennepinchon/aframe-resonance](https://github.com/etiennepinchon/aframe-resonance)</sup>

<sub>**and work by Digaverse.**</sub>  
<sup>From [digaverse/aframe-resonance-audio-component](https://github.com/digaverse/aframe-resonance-audio-component)</sup>  

<sub>**Google Resonance Audio project**</sub>  
<sup>A-Frame Resonance Audio components based on [Google Resonance Audio project](https://developers.google.com/resonance-audio/)</sub>

<sub>**Music Tempo algorithms provide autobeat data**</sub>  
<sup>Project available at [killercrush/music-tempo](https://github.com/killercrush/music-tempo)</sup>

<sub>**Elements in Demo**</sub>  
<sup>Shack model by [grimren13](https://sketchfab.com/grimren13): [Shack model](https://sketchfab.com/models/fb411967d4574ce196c8a80d0fe51095)</sup>  
<sup>Fire video by [Fire Fighting](https://www.youtube.com/channel/UCd1387wysGrbdCfYQJe4-SQ): [Video](https://www.youtube.com/watch?v=ieWT8TgScuo)</sup>  
<sup>Music *Ana Mollus* by [Noah Neumark](https://soundcloud.com/noahneumark) </sup>

***

**License:**  
Distributed under an [MIT License](https://opensource.org/licenses/MIT).
