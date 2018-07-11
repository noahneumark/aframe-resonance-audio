# What is this?

An app that creates sonic VR environments using Aframe's WebVR tools and Google's Resonance Audio engine.  I have vastly extended and re-written the two previous ResonanceAudio Aframe components to be more flexible and with access to more of Google's API including ambisonic audio source input.  In this demo, you enter a room with two speakers playing a left and a right channel of audio.  You also hear restaurant chatter around you.  As you move around, you can hear the sound change based on your positioning.  The audio engine utilizes realistic ambisonic surround rendering.

<br>[A-Frame](https://aframe.io)
<br>[ResonanceAudio](https://developers.google.com/resonance-audio/)

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
<li>Ambisonic audio can be included as a source for the room component. Set loop and autoplay.</li>
<li>Room options allow changing materials, and dimensions.</li>
<li>Sound source options include directivity patterns, gain control, maximum distance, autoplay, loop, and selection of audio channel (from a stereo source).</li>
<li>To instantiate multiple instances of the same audio source, put your audio element under the assets, and reference it with an #id tag.  You can then specify 'left' or 'right' with the 'channel' property.</li>
<li>For seamless audio loops, include your url directly onto the source entity within the room. Some devices create a gap when using the audio asset as the source.  This method avoids that. </li>
</ul>

## Challenges
<ul>
<li>Older smartphones have trouble processing many audio tracks at a time. Ambisonic audio is an intense live rendering process, so if you're designing for compatibility in mind, you will have to limit number of audio sources, and keep files uncompressed.</li>
<li>Have not yet tested media streaming, although there is some implementation in this version. </li>
<li>Have not yet tested live updating of sound attributes. </li>
<li>There is limited documentation from Google on directivity patterns, so I'm unclear exactly how those properties are affecting the sound, and it's relation with object orientation. </li>
<li>Sometimes the physics modeling causes the speakers to drop through the floor and into the pits of hell... Just refresh the page. </li>
<li>Need to include documentation.  In the meantime, look at this demo as a resource. </li>
</ul>
