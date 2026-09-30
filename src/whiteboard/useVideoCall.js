import { useEffect, useRef, useState } from 'react';

const MEDIA = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' },
};

const PROBLEMS = {
  NotAllowedError: 'Camera and microphone are blocked. Allow them for this site in your browser, then try again.',
  NotFoundError: 'No camera or microphone was found.',
  NotReadableError: 'Your camera or microphone is being used by another app.',
  OverconstrainedError: 'Your camera couldn’t start at this size.',
};

// A one-to-one video call beside the whiteboard. The room's WebSocket only carries the
// setup messages; the audio and video go browser to browser (or through the TURN relay).
// It follows the 'perfect negotiation' pattern: if both sides make an offer at the same
// moment, the student is the polite one and gives way, so the call never deadlocks.
// Camera and microphone stay off until this person clicks Start.
export function useVideoCall(role, send) {
  const polite = role === 'student';
  const [status, setStatus] = useState('off'); // off | starting | waiting | connecting | connected | error
  const [problem, setProblem] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerOnVideo, setPeerOnVideo] = useState(false);
  const sendRef = useRef(send);
  sendRef.current = send;
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const iceServers = useRef(null);
  const configWaiter = useRef(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const queue = useRef(Promise.resolve());

  const closePc = () => {
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    setRemoteStream(null);
  };

  // A fresh connection carrying this person's camera and mic. Adding the tracks makes
  // the browser ask for a negotiation, which sends our offer.
  const buildPc = () => {
    closePc();
    const pc = new RTCPeerConnection({ iceServers: iceServers.current || [] });
    pcRef.current = pc;
    pc.ontrack = ({ streams }) => {
      if (streams[0]) setRemoteStream(streams[0]);
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendRef.current({ t: 'rtc:candidate', candidate: candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
        sendRef.current({ t: 'rtc:description', description: pc.localDescription });
      } catch (error) {
        console.warn('Could not start call negotiation', error);
      } finally {
        makingOffer.current = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      const state = pc.connectionState;
      if (state === 'connected') setStatus('connected');
      else if (state === 'connecting' || state === 'disconnected') setStatus('connecting');
      else if (state === 'failed') pc.restartIce(); // try another route (like the TURN relay) before giving up
    };
    for (const track of streamRef.current.getTracks()) pc.addTrack(track, streamRef.current);
    return pc;
  };

  // STUN/TURN servers from our server, with a short-lived TURN login. Falls back to none
  // (direct connections only) if the answer doesn't come.
  const requestIceServers = () => {
    if (iceServers.current) return Promise.resolve(iceServers.current);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        configWaiter.current = null;
        resolve([]);
      }, 5000);
      configWaiter.current = (servers) => {
        clearTimeout(timer);
        configWaiter.current = null;
        iceServers.current = servers;
        resolve(servers);
      };
      sendRef.current({ t: 'rtc:config' });
    });
  };

  const start = async () => {
    if (streamRef.current) return;
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('This browser can’t do video calls here.');
      setStatus('error');
      return;
    }
    setStatus('starting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MEDIA);
    } catch (error) {
      setProblem(PROBLEMS[error.name] || 'The camera couldn’t start. Try again.');
      setStatus('error');
      return;
    }
    streamRef.current = stream;
    setLocalStream(stream);
    setMicOn(true);
    setCamOn(true);
    await requestIceServers();
    buildPc();
    setStatus(peerOnVideo ? 'connecting' : 'waiting');
    sendRef.current({ t: 'rtc:ready' });
  };

  const stop = () => {
    closePc();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setStatus('off');
    sendRef.current({ t: 'rtc:leave' });
  };

  // The other person left the video, or the room.
  const peerGone = () => {
    setPeerOnVideo(false);
    if (!streamRef.current) return;
    closePc();
    setStatus('waiting');
  };

  const toggleMic = () => {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  };

  const toggleCam = () => {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCamOn(next);
  };

  const onDescription = async (description) => {
    const pc = pcRef.current;
    if (!pc || !description) return;
    const collision = description.type === 'offer' && (makingOffer.current || pc.signalingState !== 'stable');
    ignoreOffer.current = !polite && collision;
    if (ignoreOffer.current) return;
    await pc.setRemoteDescription(description); // on a collision, the polite side rolls back here
    if (description.type === 'offer') {
      await pc.setLocalDescription();
      sendRef.current({ t: 'rtc:description', description: pc.localDescription });
    }
  };

  const onCandidate = async (candidate) => {
    const pc = pcRef.current;
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      if (!ignoreOffer.current) throw error;
    }
  };

  // Call messages from the server. Returns true when the message was about the call.
  const handle = (msg) => {
    switch (msg.t) {
      case 'rtc:config':
        configWaiter.current?.(Array.isArray(msg.iceServers) ? msg.iceServers : []);
        return true;
      case 'rtc:ready':
        setPeerOnVideo(true);
        // They're starting (or starting again after a refresh), so start a fresh connection too.
        if (streamRef.current) {
          buildPc();
          setStatus('connecting');
        }
        return true;
      case 'rtc:leave':
        peerGone();
        return true;
      case 'rtc:description':
        setPeerOnVideo(true);
        queue.current = queue.current.then(() => onDescription(msg.description)).catch((error) => console.warn('Call setup failed', error));
        return true;
      case 'rtc:candidate':
        queue.current = queue.current.then(() => onCandidate(msg.candidate)).catch(() => {});
        return true;
      default:
        return false;
    }
  };

  useEffect(
    () => () => {
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return { status, problem, localStream, remoteStream, micOn, camOn, peerOnVideo, start, stop, toggleMic, toggleCam, peerGone, handle };
}
