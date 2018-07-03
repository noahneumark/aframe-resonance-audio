# What is this?

An app that creates sonic VR environments using Aframe's WebVR tools and Google's Resonance Audio engine [A-Frame](https://aframe.io).

## Components used
<ul>
<li>Aframe physics - for drop in effect of sound sources</li>
<li>Aframe stereo component - for 3d panoramas and spheres</li>
<li>Resonance-audio-room / Resonance-audio-src - for integration of Resonance Audio into Aframe environment (making modifications to project by Digaverse https://github.com/digaverse/aframe-resonance-audio-component)</li>
</ul>
## Current status

<li>Getting "ReferenceError: Can't find variable: oldData" on Resonance-audio-room's update() function.  </li>
<li>Still no audio on iOS.  Included a click event on the enterVR button that unlocks the resume() function on audioContext, but then goes to a black screen instead of entering VR mode.</li>
