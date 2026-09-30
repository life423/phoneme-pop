import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';

function StreamVideo({ stream, muted = false, mirrored = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${mirrored ? '-scale-x-100' : ''} ${className}`} />;
}

function RoundButton({ onClick, label, tone = 'plain', children }) {
  const tones = {
    plain: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    off: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  return (
    <button type='button' onClick={onClick} aria-label={label} title={label} className={`rounded-full p-2.5 ${tones[tone]}`}>
      {children}
    </button>
  );
}

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The video call, in its own collapsible column beside the board. Hiding it keeps the call going.
export default function VideoPanel({ call, peerName, fill = false }) {
  const [open, setOpen] = useState(true);
  const on = Boolean(call.localStream);

  if (!open && fill) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='flex w-full items-center justify-between rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 shadow hover:bg-violet-50'
      >
        <span className='flex items-center gap-2'>
          <Video className='h-5 w-5' aria-hidden='true' />
          Video
          {call.status === 'connected' && <span className='text-xs font-semibold text-emerald-700'>connected</span>}
        </span>
        <span className='text-xs font-semibold text-violet-700'>Show</span>
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Show video'
        className='flex shrink-0 flex-col items-center gap-1 self-start rounded-2xl bg-white p-2 text-xs font-bold text-slate-700 shadow hover:bg-violet-50'
      >
        <Video className='h-6 w-6' aria-hidden='true' />
        Video
        {call.status === 'connected' && <span className='h-2 w-2 rounded-full bg-emerald-500' aria-hidden='true' />}
      </button>
    );
  }

  let message = 'Your camera and mic stay off until you start video.';
  if (call.status === 'starting') message = 'Turning on your camera…';
  else if (call.status === 'waiting') message = `Waiting for ${peerName} to start video`;
  else if (call.status === 'connecting') message = 'Connecting…';
  else if (!on && call.peerOnVideo) message = `${capitalise(peerName)} is on video`;

  return (
    <aside aria-label='Video call' className={`flex shrink-0 flex-col gap-3 self-start rounded-2xl bg-white p-3 shadow ${fill ? 'w-full' : 'w-64 xl:w-72'}`}>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-bold text-slate-700'>
          Video
          {call.status === 'connected' && <span className='ml-2 text-xs font-semibold text-emerald-700'>connected</span>}
        </span>
        <button
          type='button'
          onClick={() => setOpen(false)}
          aria-label='Hide video (the call keeps going)'
          title='Hide video (the call keeps going)'
          className='rounded-full p-1 text-slate-500 hover:bg-slate-100'
        >
          <ChevronRight className='h-4 w-4' aria-hidden='true' />
        </button>
      </div>
      <div className='relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900'>
        {call.remoteStream ? (
          <StreamVideo stream={call.remoteStream} className='h-full w-full object-cover' />
        ) : (
          <div className='flex h-full items-center justify-center p-3 text-center text-sm font-semibold text-slate-300'>{message}</div>
        )}
        {on && (
          <div className='absolute bottom-2 right-2 w-1/3 overflow-hidden rounded-lg border-2 border-white shadow'>
            <StreamVideo stream={call.localStream} muted mirrored className='aspect-[4/3] w-full object-cover' />
          </div>
        )}
      </div>
      {call.problem && (
        <p role='status' className='text-xs font-semibold text-rose-700'>
          {call.problem}
        </p>
      )}
      {on ? (
        <div className='flex justify-center gap-2'>
          <RoundButton onClick={call.toggleMic} label={call.micOn ? 'Mute microphone' : 'Unmute microphone'} tone={call.micOn ? 'plain' : 'off'}>
            {call.micOn ? <Mic className='h-5 w-5' aria-hidden='true' /> : <MicOff className='h-5 w-5' aria-hidden='true' />}
          </RoundButton>
          <RoundButton onClick={call.toggleCam} label={call.camOn ? 'Turn camera off' : 'Turn camera on'} tone={call.camOn ? 'plain' : 'off'}>
            {call.camOn ? <Video className='h-5 w-5' aria-hidden='true' /> : <VideoOff className='h-5 w-5' aria-hidden='true' />}
          </RoundButton>
          <RoundButton onClick={call.stop} label='Leave video' tone='danger'>
            <PhoneOff className='h-5 w-5' aria-hidden='true' />
          </RoundButton>
        </div>
      ) : (
        <button
          type='button'
          onClick={call.start}
          disabled={call.status === 'starting'}
          className='rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
        >
          {call.peerOnVideo ? `Join ${peerName} on video` : 'Start video'}
        </button>
      )}
    </aside>
  );
}
