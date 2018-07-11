# What is this?

An app that creates sonic VR environments using Aframe's WebVR tools and Google's Resonance Audio engine.  I have vastly extended the two previous ResonanceAudio Aframe components to be more flexible and with access to more of Google's API.  In this demo, you enter a room surrounded by four speakers. Left right in front, and left right in back.  As you move around, you can hear the sound change based on your positioning.  The audio engine utilizes realistic ambisonic surround rendering.

[A-Frame](https://aframe.io)
[ResonanceAudio](https://developers.google.com/resonance-audio/)

## Components used
<ul>
<li>Aframe physics - for drop in effect of sound sources</li>
<li>Aframe stereo component - for 3d panoramas and spheres</li>
<li>Resonance-audio-room / Resonance-audio-src - for integration of Resonance Audio into Aframe environment (re-write of projects by Digaverse https://github.com/digaverse/aframe-resonance-audio-component and Etiennepinchon https://github.com/etiennepinchon/aframe-resonance)</li>
</ul>

## Current status
<ul>
<li>Includes iOS audio support.  Click screen unlocks the audio to account for Safari's restrictive policy. </li>
<li>Allows for multiple audio sources within a room. </li>
<li>Room options allow changing materials, and dimensions.</li>
<li>Sound source options include directivity patterns, gain control, maximum distance, autoplay, loop, and selection of audio channel (from a stereo source).</li>
</ul>

## TBD
<ul>
<li>Working on option to add an ambisonic audio file to the room. </li>
<li>Have not yet tested media streaming, although there is some implementation in this version. </li>
<li>Have not yet tested live updating of sound attributes. </li>
<li>There is limited documentation from Google on directivity patterns, so I'm unclear exactly how those properties are affecting the sound, and it's relation with object orientation. </li>
<li>Sometimes the physics modeling causes the speakers to drop through the floor and into the pits of hell... Just refresh the page. </li>
</ul>
