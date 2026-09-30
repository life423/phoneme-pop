import { useRef, useState } from 'react';
import { navigate } from '../router.jsx';
import { useRealtime } from './useRealtime.js';
import Stage from './Stage.jsx';
import { STAGE } from './stage.js';
import { CopyButton, MessageScreen, StageNotice, StatusPill, TopBar } from './ui.jsx';

const SAVED = 'wb-tutor';

function loadSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(SAVED)) || {};
  } catch {
    return {};
  }
}

export default function TutorRoom() {
  const [room, setRoom] = useState(loadSaved); // { code, key } once the server hands them out
  const [studentHere, setStudentHere] = useState(false);
  const [hand, setHand] = useState(null);
  const [letter, setLetter] = useState(null);
  const [busy, setBusy] = useState(false);
  const roomRef = useRef(room);
  roomRef.current = room;

  const { status, send } = useRealtime({
    // Asking for the saved code again lets a refresh or a deploy keep the same room.
    hello: () => ({ t: 'create', code: roomRef.current.code, key: roomRef.current.key }),
    onMessage: (msg) => {
      if (msg.t === 'room') {
        const saved = { code: msg.code, key: msg.key };
        sessionStorage.setItem(SAVED, JSON.stringify(saved));
        setRoom(saved);
      } else if (msg.t === 'presence') {
        setStudentHere(msg.student);
        if (!msg.student) {
          setHand(null);
          setLetter(null);
        }
      } else if (msg.t === 'p') {
        setHand({ x: msg.x * STAGE.width, y: msg.y * STAGE.height });
        setLetter(msg.l);
      } else if (msg.t === 'error' && msg.reason === 'busy') {
        setBusy(true);
      }
    },
  });

  if (status === 'replaced') {
    return <MessageScreen title='Open somewhere else'>This session is now running in another tab or window.</MessageScreen>;
  }
  if (busy) {
    return <MessageScreen title='The whiteboard is busy'>Too many sessions are open right now. Try again in a minute.</MessageScreen>;
  }

  const endSession = () => {
    send({ t: 'end' });
    sessionStorage.removeItem(SAVED);
    navigate('/whiteboard');
  };

  let pill = <StatusPill tone='wait'>Waiting for your student</StatusPill>;
  if (status !== 'open') pill = <StatusPill tone='bad'>Reconnecting…</StatusPill>;
  else if (studentHere) pill = <StatusPill tone='good'>Student connected</StatusPill>;

  return (
    <div className='flex h-dvh flex-col bg-slate-200'>
      <TopBar title='Alphabet Whiteboard'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold text-slate-600'>Code</span>
          <span className='rounded-lg bg-violet-600 px-3 py-1 font-mono text-2xl font-bold tracking-widest text-white'>
            {room.code || '····'}
          </span>
          {room.code && <CopyButton text={`${window.location.origin}/whiteboard/${room.code}`} label='Copy student link' />}
        </div>
        {pill}
        <p className='text-base text-slate-700'>
          Pointing at <strong className='inline-block w-8 text-center text-2xl text-violet-700'>{letter || '–'}</strong>
        </p>
        <button
          type='button'
          onClick={endSession}
          className='rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900'
        >
          End session
        </button>
      </TopBar>
      <main className='relative min-h-0 flex-1 p-2 sm:p-4'>
        <Stage hand={hand} activeLetter={letter} smooth />
        {!studentHere && room.code && (
          <StageNotice>Your student opens myprivateteacher.com/whiteboard and types {room.code}</StageNotice>
        )}
      </main>
    </div>
  );
}
