import { toast, Toast } from 'react-hot-toast';

interface XPToastProps {
  xp: number;
  message?: string;
  t: Toast;
}

/**
 * XP reward toast component for react-hot-toast
 */
export default function XPToast({ xp, message, t }: XPToastProps) {
  return (
    <div
      className={`${t.visible ? 'animate-enter' : 'animate-leave'
        } pointer-events-auto flex w-full max-w-md rounded-2xl bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] px-5 py-4 text-white shadow-lg ring-1 ring-black/5`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl animate-bounce">🎉</div>
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold">
            {message || '축하합니다!'}
          </div>
          <div className="text-xl font-bold text-[#ffd700] drop-shadow">
            +{xp} XP
          </div>
        </div>
      </div>
      <div className="ml-auto flex border-l border-white/20 pl-4">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex w-full items-center justify-center rounded-none rounded-r-lg border-none p-0 text-sm font-medium text-white hover:text-white/80 focus:outline-none focus:ring-0"
        >
          Close
        </button>
      </div>
    </div>
  );
}
