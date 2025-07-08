# Haerenga-ki-te-Whakakotahi

function handleHandGesture(handLandmarks) {
  const indexFingerTip = handLandmarks[8]; // index finger tip
  const x = indexFingerTip.x * puzzle.contWidth;
  const y = indexFingerTip.y * puzzle.contHeight;

  // Simulate a touch event
  events.push({ event: 'touch', position: { x, y } });
}
