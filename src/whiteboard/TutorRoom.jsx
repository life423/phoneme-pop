import { useEffect, useRef, useState } from 'react';
import { Eraser, MousePointer2, Pencil, Trash2, Undo2 } from 'lucide-react';
import { navigate } from '../router.jsx';
import { useRealtime } from './useRealtime.js';
import { useFrameState, useWhiteboard } from './useWhiteboard.js';
import Stage from './Stage.jsx';
import { INK } from './board.js';
import { STAGE } from './stage.js';
import { ClearButton, Switch, ToolButton, ToolRail } from './Toolbar.jsx';
import { CopyButton, MessageScreen, StageNotice, StatusPill, TopBar } from './ui.jsx';

const SAVED = 'wb-tutor';
const round4 = (n) => Math.round(n * 10000) / 10000;
const ACTIVITY = { pen: 'Writing ✏️', eraser: 'Erasing 🧽' };

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
  const [studentTools, setStudentTools] = useState(false);
  const [tool, setTool] = useState('none');
  const [busy, setBusy] = useState(false);
  const [studentMarker, setStudentMarker] = useFrameState(null);
  const [myMarker, setMyMarker] = useFrameState(null);
  const roomRef = useRef(room);
  const studentToolsRef = useRef(studentTools);
  const sendRef = useRef(() => {});
  roomRef.current = room;
  studentToolsRef.current = studentTools;

  const wb = useWhiteboard('tutor', (msg) => sendRef.current(msg));

  const { status, send } = useRealtime({
    // Asking for the saved code again lets a refresh or a deploy keep the same room.
    hello: () => ({ t: 'create', code: roomRef.current.code, key: roomRef.current.key }),
    onMessage: (msg) => {
      if (msg.t === 'board') setStudentTools(Boolean(msg.tools));
      if (wb.handle(msg)) return;
      if (msg.t === 'room') {
        const saved = { code: msg.code, key: msg.key };
        sessionStorage.setItem(SAVED, JSON.stringify(saved));
        setRoom(saved);
        // The server restarted and forgot this room: hand it our copy of the board.
        if (msg.fresh) wb.restore(studentToolsRef.current);
      } else if (msg.t === 'tools') {
        setStudentTools(Boolean(msg.on));
      } else if (msg.t === 'presence') {
        setStudentHere(msg.student);
        if (!msg.student) setStudentMarker(null);
      } else if (msg.t === 'p') {
        setStudentMarker(
          msg.m === 'none'
            ? null
            : { kind: msg.m || 'hand', by: 'student', x: msg.x * STAGE.width, y: msg.y * STAGE.height, letter: msg.l, smooth: true },
        );
      } else if (msg.t === 'error' && msg.reason === 'busy') {
        setBusy(true);
      }
    },
  });
  sendRef.current = send;

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        wb.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wb.undo]);

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

  const chooseTool = (next) => {
    setTool(next);
    if (next === 'none') {
      setMyMarker(null);
      wb.sendPointer({ t: 'p', m: 'none' });
    }
  };

  const onPoint = (p) => {
    setMyMarker({ kind: tool, by: 'tutor', x: p.x, y: p.y });
    wb.sendPointer({ t: 'p', x: round4(p.x / STAGE.width), y: round4(p.y / STAGE.height), m: tool });
  };

  const onLeave = () => {
    setMyMarker(null);
    wb.sendPointer({ t: 'p', m: 'none' });
  };

  let pill = <StatusPill tone='wait'>Waiting for your student</StatusPill>;
  if (status !== 'open') pill = <StatusPill tone='bad'>Reconnecting…</StatusPill>;
  else if (studentHere) pill = <StatusPill tone='good'>Student connected</StatusPill>;

  const pointing = studentMarker?.kind === 'hand' ? studentMarker.letter : null;
  const activity = studentMarker && ACTIVITY[studentMarker.kind];
  const markers = [studentMarker && { key: 'student', ...studentMarker }, myMarker && { key: 'me', ...myMarker }].filter(Boolean);

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
        <Switch checked={studentTools} onChange={(on) => send({ t: 'tools', on })} label='Student tools' />
        <p className='min-w-[9rem] text-base text-slate-700'>
          {activity || (
            <>
              Pointing at <strong className='inline-block w-8 text-center text-2xl text-violet-700'>{pointing || '–'}</strong>
            </>
          )}
        </p>
        <button
          type='button'
          onClick={endSession}
          className='rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900'
        >
          End session
        </button>
      </TopBar>
      <div className='flex min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-4'>
        <ToolRail label='Your tools'>
          <ToolButton icon={MousePointer2} label='Watch' pressed={tool === 'none'} onClick={() => chooseTool('none')} />
          <ToolButton
            icon={Pencil}
            label='Pen'
            swatch={INK.tutor}
            pressed={tool === 'pen'}
            onClick={() => chooseTool(tool === 'pen' ? 'none' : 'pen')}
          />
          <ToolButton
            icon={Eraser}
            label='Eraser'
            pressed={tool === 'eraser'}
            onClick={() => chooseTool(tool === 'eraser' ? 'none' : 'eraser')}
          />
          <ToolButton icon={Undo2} label='Undo' disabled={!wb.canUndo} onClick={wb.undo} />
          <ClearButton icon={Trash2} onClear={() => send({ t: 'clear' })} />
        </ToolRail>
        <main className='relative min-h-0 flex-1'>
          <Stage
            board={wb.board}
            activeLetter={pointing}
            tool={tool}
            markers={markers}
            onPoint={onPoint}
            onLeave={onLeave}
            onStroke={{ start: (p) => wb.stroke.start(tool, p), move: wb.stroke.move, end: wb.stroke.end }}
          />
          {!studentHere && room.code && (
            <StageNotice>Your student opens myprivateteacher.com/whiteboard and types {room.code}</StageNotice>
          )}
        </main>
      </div>
    </div>
  );
}
