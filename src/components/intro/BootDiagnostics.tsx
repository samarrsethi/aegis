'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface BootDiagnosticsProps {
  apiStatus: boolean;
  onComplete: () => void;
  className?: string;
}

export interface BootDiagnosticsHandle {
  start: () => void;
  reset: () => void;
  kill: () => void;
}

interface LineProgress {
  line1: number;
  line2: number;
  line3: number;
  line4: number;
  line5Label: number;
  line5Status: number;
  line6: number;
}

const INITIAL_PROGRESS: LineProgress = {
  line1: 0,
  line2: 0,
  line3: 0,
  line4: 0,
  line5Label: 0,
  line5Status: 0,
  line6: 0,
};

interface DiagnosticLineSpec {
  label: string;
  status: string;
}

const LINE_1: DiagnosticLineSpec = { label: 'NEURAL ENGINE ........ ', status: 'ONLINE' };
const LINE_2: DiagnosticLineSpec = { label: 'LANGUAGE SYSTEM ...... ', status: 'READY' };
const LINE_3: DiagnosticLineSpec = { label: 'AUDIO INTERFACE ...... ', status: 'STANDBY' };
const LINE_4: DiagnosticLineSpec = { label: 'MEMORY SYSTEM ........ ', status: 'READY' };
const LINE_5_LABEL = 'SECURE CONNECTION .... ';
const LINE_6: DiagnosticLineSpec = { label: 'A.E.G.I.S. ........... ', status: 'ONLINE' };

function renderTypedLine(
  label: string,
  status: string,
  visibleChars: number,
  statusClassName: string,
  showCursor: boolean
) {
  const fullLength = label.length + status.length;
  const clamped = Math.max(0, Math.min(fullLength, Math.floor(visibleChars)));
  const shownLabel = label.slice(0, Math.min(clamped, label.length));
  const shownStatus =
    clamped > label.length ? status.slice(0, clamped - label.length) : '';
  const isTyping = clamped > 0 && clamped < fullLength && showCursor;

  return (
    <span className="inline-flex items-center whitespace-pre">
      <span className="text-aegis-text-secondary">{shownLabel}</span>
      <span className={statusClassName}>{shownStatus}</span>
      {isTyping && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 bg-aegis-cyan/80 animate-pulse"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export const BootDiagnostics = forwardRef<BootDiagnosticsHandle, BootDiagnosticsProps>(
  function BootDiagnostics({ apiStatus, onComplete, className = '' }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scanlineRef = useRef<HTMLDivElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const [active, setActive] = useState(false);
    const [connectionResolved, setConnectionResolved] = useState(false);
    const [progress, setProgress] = useState<LineProgress>(INITIAL_PROGRESS);

    const kill = useCallback(() => {
      tlRef.current?.kill();
      tlRef.current = null;
    }, []);

    const reset = useCallback(() => {
      kill();
      setActive(false);
      setConnectionResolved(false);
      setProgress(INITIAL_PROGRESS);
      if (scanlineRef.current) {
        gsap.set(scanlineRef.current, { yPercent: -15, opacity: 0 });
      }
    }, [kill]);

    const start = useCallback(() => {
      kill();
      setActive(true);
      setConnectionResolved(false);
      setProgress(INITIAL_PROGRESS);

      const tracker: LineProgress = { ...INITIAL_PROGRESS };
      const syncState = () => setProgress({ ...tracker });

      const resolvedStatusLength = Math.max(
        'ESTABLISHED'.length,
        'UNAVAILABLE'.length
      );

      const tl = gsap.timeline({
        onComplete: () => {
          onCompleteRef.current();
        },
      });

      // Subtle HUD container reveal
      if (containerRef.current) {
        tl.fromTo(
          containerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: 'power2.out' },
          0
        );
      }

      // Moving horizontal gradient scanline across screen
      if (scanlineRef.current) {
        tl.fromTo(
          scanlineRef.current,
          { yPercent: -10, opacity: 0 },
          {
            yPercent: 1050,
            opacity: 1,
            duration: 1.45,
            ease: 'sine.inOut',
          },
          0
        ).to(
          scanlineRef.current,
          {
            opacity: 0,
            duration: 0.25,
            ease: 'power2.out',
          },
          1.25
        );
      }

      // Line 1: NEURAL ENGINE ........ ONLINE
      tl.to(
        tracker,
        {
          line1: LINE_1.label.length + LINE_1.status.length,
          duration: 0.26,
          ease: 'none',
          onUpdate: syncState,
        },
        0.05
      );

      // Line 2: LANGUAGE SYSTEM ...... READY
      tl.to(
        tracker,
        {
          line2: LINE_2.label.length + LINE_2.status.length,
          duration: 0.26,
          ease: 'none',
          onUpdate: syncState,
        },
        0.22
      );

      // Line 3: AUDIO INTERFACE ...... STANDBY
      tl.to(
        tracker,
        {
          line3: LINE_3.label.length + LINE_3.status.length,
          duration: 0.26,
          ease: 'none',
          onUpdate: syncState,
        },
        0.39
      );

      // Line 4: MEMORY SYSTEM ........ READY
      tl.to(
        tracker,
        {
          line4: LINE_4.label.length + LINE_4.status.length,
          duration: 0.26,
          ease: 'none',
          onUpdate: syncState,
        },
        0.54
      );

      // Line 5: SECURE CONNECTION .... CHECKING -> ESTABLISHED / UNAVAILABLE
      tl.to(
        tracker,
        {
          line5Label: LINE_5_LABEL.length,
          duration: 0.2,
          ease: 'none',
          onUpdate: syncState,
        },
        0.68
      ).to(
        tracker,
        {
          line5Status: 'CHECKING'.length,
          duration: 0.14,
          ease: 'none',
          onUpdate: syncState,
        },
        0.88
      );

      // Pause briefly on CHECKING then resolve to actual apiStatus
      tl.call(
        () => {
          setConnectionResolved(true);
          tracker.line5Status = 0;
          syncState();
        },
        [],
        1.14
      ).to(
        tracker,
        {
          line5Status: resolvedStatusLength,
          duration: 0.16,
          ease: 'none',
          onUpdate: syncState,
        },
        1.15
      );

      // Line 6: A.E.G.I.S. ........... ONLINE (bottom-left)
      tl.to(
        tracker,
        {
          line6: LINE_6.label.length + LINE_6.status.length,
          duration: 0.28,
          ease: 'none',
          onUpdate: syncState,
        },
        1.24
      );

      // Hold a beat so final line reads cleanly before completion callback
      tl.to({}, { duration: 0.08 });

      tlRef.current = tl;
    }, [kill]);

    useEffect(() => {
      return () => {
        kill();
      };
    }, [kill]);

    useImperativeHandle(
      ref,
      () => ({
        start,
        reset,
        kill,
      }),
      [start, reset, kill]
    );

    const line5StatusText = connectionResolved
      ? apiStatus
        ? 'ESTABLISHED'
        : 'UNAVAILABLE'
      : 'CHECKING';

    const line5StatusClass = connectionResolved
      ? apiStatus
        ? 'text-aegis-cyan font-medium'
        : 'text-aegis-amber font-medium'
      : 'text-aegis-ice/80';

    const line5TotalChars =
      progress.line5Label + Math.min(progress.line5Status, line5StatusText.length);

    return (
      <div
        ref={containerRef}
        className={`fixed inset-0 pointer-events-none select-none overflow-hidden transition-opacity duration-200 ${
          active ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        aria-hidden={!active}
      >
        {/* Subtle static HUD micro-scanline texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(83, 217, 232, 0.35) 0px, transparent 1px, transparent 3px)',
          }}
        />

        {/* Moving horizontal gradient scanline sweep */}
        <div
          ref={scanlineRef}
          className="absolute inset-x-0 top-0 h-20 opacity-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(83, 217, 232, 0) 0%, rgba(83, 217, 232, 0.06) 45%, rgba(168, 234, 240, 0.22) 50%, rgba(83, 217, 232, 0.06) 55%, rgba(83, 217, 232, 0) 100%)',
          }}
        />

        {/* Top-Left Diagnostic Group */}
        <div className="absolute top-6 left-6 sm:top-8 sm:left-8 max-w-[calc(100vw-3rem)]">
          <div className="border-l-2 border-t border-aegis-cyan/25 pl-3 pt-2 pr-4 pb-2 bg-aegis-obsidian/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] text-aegis-text-secondary/80 mb-2 uppercase">
              <Activity className="w-3 h-3 text-aegis-cyan/80" />
              <span>SYS // CORE DIAGNOSTICS</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px] sm:text-xs tracking-wider leading-relaxed">
              <div>
                {renderTypedLine(
                  LINE_1.label,
                  LINE_1.status,
                  progress.line1,
                  'text-aegis-cyan font-medium',
                  active
                )}
              </div>
              <div>
                {renderTypedLine(
                  LINE_2.label,
                  LINE_2.status,
                  progress.line2,
                  'text-aegis-cyan font-medium',
                  active
                )}
              </div>
              <div>
                {renderTypedLine(
                  LINE_3.label,
                  LINE_3.status,
                  progress.line3,
                  'text-aegis-text-secondary',
                  active
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Diagnostic Group (positioned cleanly below Skip button) */}
        <div className="absolute top-[10.25rem] right-6 sm:top-16 sm:right-8 text-left">
          <div className="border-r-2 border-t border-aegis-cyan/25 pr-3 pt-2 pl-4 pb-2 bg-aegis-obsidian/40 backdrop-blur-[2px]">
            <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] tracking-[0.22em] text-aegis-text-secondary/80 mb-2 uppercase">
              <span>NET // TELEMETRY LINK</span>
              {connectionResolved && !apiStatus ? (
                <ShieldAlert className="w-3 h-3 text-aegis-amber" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-aegis-cyan/80" />
              )}
            </div>
            <div className="space-y-1.5 font-mono text-[11px] sm:text-xs tracking-wider leading-relaxed">
              <div>
                {renderTypedLine(
                  LINE_4.label,
                  LINE_4.status,
                  progress.line4,
                  'text-aegis-cyan font-medium',
                  active
                )}
              </div>
              <div>
                {renderTypedLine(
                  LINE_5_LABEL,
                  line5StatusText,
                  line5TotalChars,
                  line5StatusClass,
                  active
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Left Master Status Corner */}
        <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8">
          <div className="border-l-2 border-b border-aegis-cyan/30 pl-3 pb-2 pr-4 pt-1.5 bg-aegis-obsidian/40 backdrop-blur-[2px]">
            <div className="font-mono text-xs sm:text-sm tracking-[0.14em] aegis-glow-text">
              {renderTypedLine(
                LINE_6.label,
                LINE_6.status,
                progress.line6,
                'text-aegis-cyan font-semibold',
                active
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default BootDiagnostics;
