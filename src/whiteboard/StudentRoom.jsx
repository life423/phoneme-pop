import { useEffect, useRef, useState } from 'react';
import { navigate } from '../router.jsx';
import { useRealtime } from './useRealtime.js';
import Stage from './Stage.jsx';
import { STAGE } from './stage.js';
import { MessageScreen, StageNotice, StatusPill, TopBar } from './ui.jsx';

const SEND_EVERY_MS = 33; // about 30 updates a second; the newest position always wins
const round = (n) => Math.round(n * 10000) / 10000;

const ENDINGS = {
  'no-room': ['We can’t find that room', 'Check the 4-digit code with your tutor and try again.'],
  'room-full': ['That room already has a student', 'Check the code with your tutor.'],
  'slow-down': ['Too many tries', 'Wait a minute, then try your code again.'],
  closed: ['The session is over', 'Your tutor ended the session. Great work!'],
  replaced: ['Open somewhere else', 'This session is now running in another tab or window.'],
};

export default function StudentRoom({ code }) {
  const storageKey = `wb-student-${code}`;
  const [hand, setHand] = useState(null);
  const [letter, setLetter] = useState(null);
  const [phase, setPhase] = useState('joining'); // joining | in | rejoining | a key of ENDINGS
  const [tutorHere, setTutorHere] = useState(true);
  const keyRef = useRef(sessionStorage.getItem(storageKey));
  const joined = useRef(false);
  const retries = useRef(0);
  const retryTimer = useRef(null);
  const sendTimer = useRef(null);
  const pending = useRef(null);
  const lastSent = useRef(0);
  const sendRef = useRef(() => {});

  const joinMessage = () => ({ t: 'join', code, key: keyRef.current || undefined });

  const { status, send } = useRealtime({
    hello: joinMessage,
    onMessage: (msg) => {
      if (msg.t === 'room') {
        keyRef.current = msg.key;
        sessionStorage.setItem(storageKey, msg.key);
        joined.current = true;
        retries.current = 0;
        setPhase('in');
      } else if (msg.t === 'presence') {
        setTutorHere(msg.tutor);
      } else if (msg.t === 'closed') {
        sessionStorage.removeItem(storageKey);
        setPhase('closed');
      } else if (msg.t === 'error') {
        // After a deploy the room comes back once the tutor reconnects, so keep trying for a minute.
        if (msg.reason === 'no-room' && joined.current && retries.current < 30) {
          retries.current += 1;
          setPhase('rejoining');
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => sendRef.current(joinMessage()), 2000);
        } else {
          setPhase(msg.reason);
        }
      }
    },
  });
  sendRef.current = send;

  useEffect(
    () => () => {
      clearTimeout(retryTimer.current);
      clearTimeout(sendTimer.current);
    },
    [],
  );

  const point = ({ x, y, letter: under }) => {
    setHand({ x, y });
    setLetter(under);
    pending.current = { t: 'p', x: round(x / STAGE.width), y: round(y / STAGE.height), l: under };
    if (sendTimer.current) return;
    const wait = Math.max(0, SEND_EVERY_MS - (performance.now() - lastSent.current));
    sendTimer.current = setTimeout(() => {
      sendTimer.current = null;
      lastSent.current = performance.now();
      send(pending.current);
    }, wait);
  };

  const ending = ENDINGS[status === 'replaced' ? 'replaced' : phase];
  if (ending) return <MessageScreen title={ending[0]}>{ending[1]}</MessageScreen>;

  const leave = () => {
    send({ t: 'leave' });
    sessionStorage.removeItem(storageKey);
    navigate('/whiteboard');
  };

  let pill = <StatusPill tone='good'>Connected to your tutor</StatusPill>;
  if (status !== 'open' || phase === 'rejoining') {
    pill = <StatusPill tone={joined.current ? 'bad' : 'wait'}>{joined.current ? 'Reconnecting…' : 'Connecting…'}</StatusPill>;
  } else if (phase === 'joining') {
    pill = <StatusPill tone='wait'>Joining…</StatusPill>;
  } else if (!tutorHere) {
    pill = <StatusPill tone='wait'>Waiting for your tutor</StatusPill>;
  }

  return (
    <div className='flex h-dvh flex-col bg-slate-200'>
      <TopBar title='Alphabet Whiteboard'>
        <span className='text-base font-semibold text-slate-700'>Room {code}</span>
        {pill}
        <button
          type='button'
          onClick={leave}
          className='rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900'
        >
          Leave
        </button>
      </TopBar>
      <p className='hidden bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 portrait:max-lg:block'>
        Turn your tablet sideways for bigger letters.
      </p>
      <main className='relative min-h-0 flex-1 p-2 sm:p-4'>
        <Stage hand={hand} activeLetter={letter} onPoint={point} />
        {phase === 'in' && !tutorHere && <StageNotice>Waiting for your tutor…</StageNotice>}
        {phase === 'in' && tutorHere && !hand && <StageNotice>Move the hand to a letter ✋</StageNotice>}
      </main>
    </div>
  );
}
