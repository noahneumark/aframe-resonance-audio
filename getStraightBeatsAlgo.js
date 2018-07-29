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
console.log(beatLength);
console.log(JSON.stringify(beats)); //copy this output and save into a json file
