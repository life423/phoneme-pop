import { useEffect, useRef, useState } from 'react';
import { Eraser, Hand as HandIcon, MousePointer2, Pencil, Trash2, Undo2 } from 'lucide-react';
import { navigate } from '../router.jsx';
import { useRealtime } from './useRealtime.js';
import { useFrameState, useWhiteboard } from './useWhiteboard.js';
import Stage from './Stage.jsx';
import { INK } from './board.js';
import { BOARD_SHAPE, PARKED_HAND, STAGE, letterAt } from './stage.js';
import { ClearButton, Switch, ToolButton, ToolRail } from './Toolbar.jsx';
import TileBar from './TileBar.jsx';
import PicturesPanel from './PicturesPanel.jsx';
import { pictureUrl } from './pictures.js';
import VideoPanel from './VideoPanel.jsx';
import { useVideoCall } from './useVideoCall.js';
import { CopyButton, MessageScreen, StageNotice, StatusPill, TopBar } from './ui.jsx';

const SAVED = 'wb-tutor';
const round4 = (n) => Math.round(n * 10000) / 10000;
const ACTIVITY = { pen: 'Writing ✏️', eraser: 'Erasing 🧽' };
const PARKED_STUDENT = { kind: 'hand', by: 'student', x: PARKED_HAND.x, y: PARKED_HAND.y, letter: null, smooth: true };

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
  const [tip, setTip] = useState(null);
  const [selectedTileId, setSelectedTileId] = useState(null); // clicked, ready to change
  const [sidePanel, setSidePanel] = useState('tiles'); // the side column's tab: letter tiles or pictures
  const stageApi = useRef(null);
  const [studentMarker, setStudentMarker] = useFrameState(null);
  const [myMarker, setMyMarker] = useFrameState(null);
  const roomRef = useRef(room);
  const studentToolsRef = useRef(studentTools);
  const sendRef = useRef(() => {});
  const lastPoint = useRef(null);
  const dragging = useRef(false); // true while you're moving the student's hand
  const tipShown = useRef(false);
  roomRef.current = room;
  studentToolsRef.current = studentTools;

  const wb = useWhiteboard('tutor', (msg) => sendRef.current(msg));
  const call = useVideoCall('tutor', (msg) => sendRef.current(msg));

  const { status, send } = useRealtime({
    // Asking for the saved code again lets a refresh or a deploy keep the same room.
    hello: () => ({ t: 'create', code: roomRef.current.code, key: roomRef.current.key }),
    onMessage: (msg) => {
      if (call.handle(msg)) return;
      if (msg.t === 'board') setStudentTools(Boolean(msg.tools));
      if (wb.handle(msg)) return;
      if (msg.t === 'room') {
        const saved = { code: msg.code, key: msg.key };
        sessionStorage.setItem(SAVED, JSON.stringify(saved));
        setRoom(saved);
        // The server restarted and forgot this room: hand it our copy of the board.
        if (msg.fresh) wb.restore(studentToolsRef.current, saved);
      } else if (msg.t === 'tools') {
        setStudentTools(Boolean(msg.on));
      } else if (msg.t === 'presence') {
        if (msg.student && !studentHere) {
          setStudentMarker(PARKED_STUDENT);
          if (!tipShown.current) {
            tipShown.current = true;
            setTip('Tip: drag your student’s hand to guide it');
          }
        }
        if (!msg.student) {
          setStudentMarker(null);
          call.peerGone();
        }
        setStudentHere(msg.student);
      } else if (msg.t === 'p') {
        if (dragging.current) return; // you have the student's hand right now
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
    if (!tip) return undefined;
    const timer = setTimeout(() => setTip(null), 5000);
    return () => clearTimeout(timer);
  }, [tip]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLInputElement) return; // leave typing alone
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

  // Shows your pointer here and on the student's screen.
  const share = (p, mode) => {
    lastPoint.current = p;
    const letter = mode === 'hand' ? p.letter : null;
    setMyMarker({ kind: mode, by: 'tutor', x: p.x, y: p.y, letter });
    wb.sendPointer({ t: 'p', x: round4(p.x / STAGE.width), y: round4(p.y / STAGE.height), l: letter, m: mode });
  };

  const chooseTool = (next) => {
    setTool(next);
    if (next === 'none') {
      setMyMarker(null);
      wb.sendPointer({ t: 'p', m: 'none' });
      return;
    }
    const p = lastPoint.current;
    if (p) share({ ...p, letter: letterAt(p.x, p.y, wb.strip) }, next);
  };

  const onPoint = (p) => share(p, tool);

  // Dragging the student's hand: it moves here right away and glides on their screen.
  const grab = {
    start: () => {
      dragging.current = true;
    },
    move: (p) => {
      setStudentMarker({ kind: 'hand', by: 'student', x: p.x, y: p.y, letter: p.letter, smooth: false });
      wb.sendMove({ t: 'move', x: round4(p.x / STAGE.width), y: round4(p.y / STAGE.height), l: p.letter });
    },
    end: () => {
      dragging.current = false;
    },
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
        <Switch checked={wb.strip} onChange={wb.setStrip} label='Alphabet strip' />
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
      <div className='flex min-h-0 flex-1 items-start justify-center gap-2 p-2 sm:gap-4 sm:p-4'>
        <ToolRail label='Your tools'>
          <ToolButton icon={MousePointer2} label='Watch' pressed={tool === 'none'} onClick={() => chooseTool('none')} />
          <ToolButton
            icon={HandIcon}
            label='Hand'
            swatch={INK.tutor}
            pressed={tool === 'hand'}
            onClick={() => chooseTool(tool === 'hand' ? 'none' : 'hand')}
          />
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
        <main className='relative h-full min-w-0 rounded-2xl bg-slate-100 shadow' style={BOARD_SHAPE}>
          <Stage
            board={wb.board}
            me='tutor'
            strip={wb.strip}
            boxes={wb.boxes}
            tiles={wb.tiles}
            selectedTile={selectedTileId}
            canManageTiles
            tileActions={{ ...wb.tileActions, select: setSelectedTileId }}
            pieces={wb.pieces}
            pictures={wb.pictures}
            pictureSrc={(id) => pictureUrl(room.code, id)}
            pieceActions={wb.pieceActions}
            canEditPieces
            canDeletePieces
            canDuplicatePieces
            stageApi={stageApi}
            letters={{ student: pointing, tutor: myMarker?.kind === 'hand' ? myMarker.letter : null }}
            tool={tool}
            markers={markers}
            grabbable={studentMarker?.kind === 'hand' ? studentMarker : null}
            onGrab={grab}
            onPoint={onPoint}
            onLeave={onLeave}
            onStroke={{ start: (p) => wb.stroke.start(tool, p), move: wb.stroke.move, end: wb.stroke.end }}
          />
          {!studentHere && room.code && (
            <StageNotice>Your student opens myprivateteacher.com/whiteboard and types {room.code}</StageNotice>
          )}
          {studentHere && tip && <StageNotice>{tip}</StageNotice>}
        </main>
        <div className='-m-1 flex max-h-full w-64 shrink-0 flex-col gap-2 overflow-y-auto p-1 sm:gap-4 xl:w-72'>
          <VideoPanel call={call} peerName='your student' fill />
          <div role='tablist' aria-label='Things for the board' className='grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow'>
            {[
              ['tiles', 'Letter tiles'],
              ['pictures', 'Pictures'],
            ].map(([id, label]) => (
              <button
                key={id}
                type='button'
                role='tab'
                aria-selected={sidePanel === id}
                onClick={() => setSidePanel(id)}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${sidePanel === id ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={sidePanel === 'tiles' ? '' : 'hidden'}>
          <TileBar
            count={wb.tiles.length}
            selected={wb.tiles.find((t) => t.id === selectedTileId) || null}
            onAdd={wb.addTiles}
            onEdit={(text) => {
              const ok = wb.editTile(selectedTileId, text);
              if (ok) setSelectedTileId(null);
              return ok;
            }}
            onCancelEdit={() => setSelectedTileId(null)}
            onReset={wb.resetTiles}
            onClear={wb.clearTiles}
            boxes={wb.boxes}
            onBoxes={wb.setBoxes}
          />
          </div>
          <div className={sidePanel === 'pictures' ? '' : 'hidden'}>
            <PicturesPanel
              pictures={wb.pictures}
              srcFor={(id) => pictureUrl(room.code, id)}
              canAdd
              onAddFile={(file) => wb.addPicture(file, room)}
              onClear={wb.clearPictures}
              offers={wb.offers}
              onOffer={wb.offerActions.give}
              onWithdraw={wb.offerActions.withdraw}
              onReset={wb.offerActions.reset}
              onPlace={wb.pieceActions.add}
              stageApi={stageApi}
              onShow={() => setSidePanel('pictures')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
