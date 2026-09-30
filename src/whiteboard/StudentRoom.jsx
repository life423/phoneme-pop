import { useEffect, useRef, useState } from 'react';
import { Eraser, Hand as HandIcon, Image as ImageIcon, Pencil, Undo2 } from 'lucide-react';
import { navigate } from '../router.jsx';
import { useRealtime } from './useRealtime.js';
import { useFrameState, useWhiteboard } from './useWhiteboard.js';
import Stage from './Stage.jsx';
import { INK } from './board.js';
import { PARKED_HAND, STAGE, letterAt } from './stage.js';
import WhiteboardLayout from './WhiteboardLayout.jsx';
import { ToolButton, ToolRail } from './Toolbar.jsx';
import PicturesPanel from './PicturesPanel.jsx';
import { pictureUrl } from './pictures.js';
import { useVideoCall } from './useVideoCall.js';
import { FocusButton, MessageScreen, StageNotice, StatusPill, TopBar } from './ui.jsx';

const round4 = (n) => Math.round(n * 10000) / 10000;
const PARKED = { kind: 'hand', by: 'student', x: PARKED_HAND.x, y: PARKED_HAND.y, letter: null };

const ENDINGS = {
  'no-room': ['We can’t find that room', 'Check the 4-digit code with your tutor and try again.'],
  'room-full': ['That room already has a student', 'Check the code with your tutor.'],
  'slow-down': ['Too many tries', 'Too many wrong codes from this network. Wait a few minutes, then try again.'],
  closed: ['The session is over', 'Your tutor ended the session. Great work!'],
  replaced: ['Open somewhere else', 'This session is now running in another tab or window.'],
};

export default function StudentRoom({ code }) {
  const storageKey = `wb-student-${code}`;
  const [phase, setPhase] = useState('joining'); // joining | in | rejoining | a key of ENDINGS
  const [tutorHere, setTutorHere] = useState(true);
  const [toolsOn, setToolsOn] = useState(false);
  const [tool, setTool] = useState('hand');
  const stageApi = useRef(null);
  const layout = useRef(null); // the shared layout: open a panel, focus mode
  // Zoom and pan are this screen's own. The tutor sees which part of the board it shows, and
  // can bring it to the part they're teaching (follow tutor).
  const [follow, setFollow] = useState(null);
  const lastView = useRef(null);
  const viewTimer = useRef(null);
  const sendView = (rect) => {
    lastView.current = rect;
    if (viewTimer.current) return;
    viewTimer.current = setTimeout(() => {
      viewTimer.current = null;
      sendRef.current?.({ t: 'view', ...lastView.current });
    }, 200);
  };
  const [notice, setNotice] = useState(null);
  const [touched, setTouched] = useState(false);
  const [myMarker, setMyMarker] = useFrameState(null);
  const [tutorMarker, setTutorMarker] = useFrameState(null);
  const keyRef = useRef(sessionStorage.getItem(storageKey));
  const joined = useRef(false);
  const retries = useRef(0);
  const retryTimer = useRef(null);
  const lastPoint = useRef(null);
  const sendRef = useRef(() => {});

  const wb = useWhiteboard('student', (msg) => sendRef.current(msg));
  const call = useVideoCall('student', (msg) => sendRef.current(msg));
  const joinMessage = () => ({ t: 'join', code, key: keyRef.current || undefined });

  // The tutor decides whether the toolbar is available.
  const applyTools = (on, announce) => {
    setToolsOn(on);
    if (!on) setTool('hand');
    if (announce) setNotice(on ? 'Your tutor turned on your tools ✏️' : 'Your tutor turned off the tools');
  };

  const { status, send } = useRealtime({
    hello: joinMessage,
    onMessage: (msg) => {
      if (call.handle(msg)) return;
      if (msg.t === 'board') applyTools(Boolean(msg.tools), false);
      if (wb.handle(msg)) return;
      if (msg.t === 'focus') return setFollow({ x: msg.x, y: msg.y, w: msg.w, h: msg.h, n: Date.now() });
      if (msg.t === 'tools') {
        applyTools(Boolean(msg.on), true);
      } else if (msg.t === 'room') {
        keyRef.current = msg.key;
        sessionStorage.setItem(storageKey, msg.key);
        joined.current = true;
        retries.current = 0;
        setPhase('in');
        // Your hand starts parked at the bottom of the board, the same spot your tutor sees.
        if (!lastPoint.current) {
          lastPoint.current = { x: PARKED.x, y: PARKED.y, letter: null };
          setMyMarker(PARKED);
        }
      } else if (msg.t === 'moved') {
        // Your tutor is guiding your hand.
        if (tool !== 'hand') return;
        const p = { x: msg.x * STAGE.width, y: msg.y * STAGE.height, letter: msg.l };
        lastPoint.current = p;
        setMyMarker({ kind: 'hand', by: 'student', ...p, smooth: true });
      } else if (msg.t === 'presence') {
        setTutorHere(msg.tutor);
        if (!msg.tutor) {
          setTutorMarker(null);
          call.peerGone();
        }
      } else if (msg.t === 'p') {
        setTutorMarker(
          msg.m === 'none'
            ? null
            : { kind: msg.m, by: 'tutor', x: msg.x * STAGE.width, y: msg.y * STAGE.height, letter: msg.l, smooth: true },
        );
      } else if (msg.t === 'closed') {
        sessionStorage.removeItem(storageKey);
        setPhase('closed');
      } else if (msg.t === 'error') {
        // After a deploy the room comes back once the tutor reconnects, so keep trying for about a
        // minute, less often as it goes: each miss counts toward the server's limit on wrong codes.
        if (msg.reason === 'no-room' && joined.current && retries.current < 8) {
          const wait = Math.min(12_000, 2000 * 1.5 ** retries.current);
          retries.current += 1;
          setPhase('rejoining');
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => sendRef.current(joinMessage()), wait);
        } else {
          setPhase(msg.reason);
        }
      }
    },
  });
  sendRef.current = send;

  useEffect(() => () => clearTimeout(retryTimer.current), []);
  useEffect(() => () => clearTimeout(viewTimer.current), []);
  // When the tutor arrives (or comes back), tell them what this screen shows.
  useEffect(() => {
    if (tutorHere && lastView.current) sendRef.current?.({ t: 'view', ...lastView.current });
  }, [tutorHere]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!toolsOn) return undefined;
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        wb.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolsOn, wb.undo]);

  // Shows this pointer locally and shares it with the tutor.
  const share = (p, mode) => {
    lastPoint.current = p;
    if (!touched) setTouched(true);
    const letter = mode === 'hand' ? p.letter : null;
    setMyMarker({ kind: mode, by: 'student', x: p.x, y: p.y, letter });
    wb.sendPointer({ t: 'p', x: round4(p.x / STAGE.width), y: round4(p.y / STAGE.height), l: letter, m: mode });
  };

  const chooseTool = (next) => {
    setTool(next);
    const p = lastPoint.current;
    if (p) share({ ...p, letter: letterAt(p.x, p.y, wb.strip) }, next);
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

  const markers = [tutorMarker && { key: 'tutor', ...tutorMarker }, myMarker && { key: 'me', ...myMarker }].filter(Boolean);

  return (
    <WhiteboardLayout
      header={
        <TopBar
          title='Alphabet Whiteboard'
          menu={<FocusButton onClick={() => layout.current?.setFocus(true)} />}
          end={
            <button
              type='button'
              onClick={leave}
              className='shrink-0 rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900'
            >
              Leave
            </button>
          }
        >
          <span className='shrink-0 text-base font-semibold text-slate-700'>Room {code}</span>
          {pill}
        </TopBar>
      }
      banner={
        <p className='hidden bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 portrait:max-lg:block'>
          Turn your screen sideways for bigger letters.
        </p>
      }
      tools={
        toolsOn && (
          <ToolRail label='Your tools'>
            <ToolButton icon={HandIcon} label='Hand' pressed={tool === 'hand'} onClick={() => chooseTool('hand')} />
            <ToolButton icon={Pencil} label='Pen' swatch={INK.student} pressed={tool === 'pen'} onClick={() => chooseTool('pen')} />
            <ToolButton icon={Eraser} label='Eraser' pressed={tool === 'eraser'} onClick={() => chooseTool('eraser')} />
            <ToolButton icon={Undo2} label='Undo' disabled={!wb.canUndo} onClick={wb.undo} />
          </ToolRail>
        )
      }
      board={
        <>
          <Stage
            board={wb.board}
            me='student'
            strip={wb.strip}
            boxes={wb.boxes}
            tiles={wb.tiles}
            tileActions={wb.tileActions}
            pieces={wb.pieces}
            pictures={wb.pictures}
            pictureSrc={(id) => pictureUrl(code, id)}
            pieceActions={wb.pieceActions}
            canEditPieces={toolsOn}
            onView={sendView}
            focus={follow}
            stageApi={stageApi}
            letters={{
              student: myMarker?.kind === 'hand' ? myMarker.letter : null,
              tutor: tutorMarker?.kind === 'hand' ? tutorMarker.letter : null,
            }}
            tool={tool}
            markers={markers}
            onPoint={(p) => share(p, tool)}
            onLeave={() => {
              setMyMarker(null);
              wb.sendPointer({ t: 'p', m: 'none' });
            }}
            onStroke={{ start: (p) => wb.stroke.start(tool, p), move: wb.stroke.move, end: wb.stroke.end }}
          />
          {phase === 'in' && notice && <StageNotice>{notice}</StageNotice>}
          {phase === 'in' && !notice && !tutorHere && <StageNotice>Waiting for your tutor…</StageNotice>}
          {phase === 'in' && !notice && tutorHere && !touched && !toolsOn && (
            <StageNotice>Move the hand to a letter ✋</StageNotice>
          )}
        </>
      }
      call={call}
      peerName='your tutor'
      controls={layout}
      panels={[
        {
          id: 'pictures',
          label: 'Pictures',
          icon: ImageIcon,
          content: (
            <PicturesPanel
              pictures={wb.pictures}
              offers={wb.offers}
              canTake={toolsOn}
              srcFor={(id) => pictureUrl(code, id)}
              onPlace={wb.pieceActions.add}
              stageApi={stageApi}
              onPlaced={() => layout.current?.closeSheet()}
            />
          ),
        },
      ]}
    />
  );
}
