'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import gsap from 'gsap';

export interface ArmorAssemblyProps {
  onAssemblyComplete: () => void;
  className?: string;
}

export interface ArmorAssemblyHandle {
  startAssembly: () => void;
  resetAssembly: () => void;
  kill: () => void;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const ArmorAssembly = forwardRef<ArmorAssemblyHandle, ArmorAssemblyProps>(
  function ArmorAssembly({ onAssemblyComplete, className = '' }, ref) {
    const svgRef = useRef<SVGSVGElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const onCompleteRef = useRef(onAssemblyComplete);
    onCompleteRef.current = onAssemblyComplete;

    const applyInitialOffsets = useCallback(() => {
      const svg = svgRef.current;
      if (!svg) return;

      const q = gsap.utils.selector(svg);

      // 1. Chest center & collar start below
      gsap.set(q('#chest-center'), { x: 0, y: 95, scale: 0.92, opacity: 0, transformOrigin: '200px 210px' });
      gsap.set(q('#torso-collar'), { x: 0, y: 45, opacity: 0, transformOrigin: '200px 140px' });

      // 2. Left/right chest plates & torso flanks start off-center
      gsap.set(q('#chest-left'), { x: -115, y: 12, opacity: 0, transformOrigin: '140px 200px' });
      gsap.set(q('#chest-right'), { x: 115, y: 12, opacity: 0, transformOrigin: '260px 200px' });
      gsap.set(q('#torso-ab-center'), { x: 0, y: 90, opacity: 0, transformOrigin: '200px 330px' });
      gsap.set(q('#torso-flank-left'), { x: -85, y: 40, opacity: 0, transformOrigin: '145px 310px' });
      gsap.set(q('#torso-flank-right'), { x: 85, y: 40, opacity: 0, transformOrigin: '255px 310px' });

      // 3. Shoulders start above with slight opposing rotation
      gsap.set(q('#shoulder-left'), { x: -35, y: -90, rotation: -16, opacity: 0, transformOrigin: '105px 175px' });
      gsap.set(q('#shoulder-right'), { x: 35, y: -90, rotation: 16, opacity: 0, transformOrigin: '295px 175px' });

      // 4. Arm segments start wide to sides
      gsap.set(q('#arm-left'), { x: -125, y: 18, opacity: 0, transformOrigin: '75px 300px' });
      gsap.set(q('#arm-right'), { x: 125, y: 18, opacity: 0, transformOrigin: '325px 300px' });

      // 5. Helmet panels converge from multiple directions
      gsap.set(q('#helmet-crown'), { x: 0, y: -75, opacity: 0, transformOrigin: '200px 60px' });
      gsap.set(q('#helmet-left-cheek'), { x: -70, y: 20, rotation: -8, opacity: 0, transformOrigin: '170px 95px' });
      gsap.set(q('#helmet-right-cheek'), { x: 70, y: 20, rotation: 8, opacity: 0, transformOrigin: '230px 95px' });
      gsap.set(q('#helmet-faceplate'), { x: 0, y: 48, scale: 0.88, opacity: 0, transformOrigin: '200px 105px' });

      // 6. Energy conduits hidden with dashoffset = path length
      const conduits = svg.querySelectorAll<SVGPathElement>('#energy-conduits path');
      conduits.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: 0,
        });
      });

      // 7. Visor lights off
      gsap.set(q('#helmet-visor'), { opacity: 0, scale: 0.92, transformOrigin: '200px 85px' });

      // Frame reticle subtle guides
      gsap.set(q('#armor-hud-guides'), { opacity: 0 });
    }, []);

    useIsomorphicLayoutEffect(() => {
      const ctx = gsap.context(() => {
        applyInitialOffsets();
      }, svgRef);

      return () => {
        tlRef.current?.kill();
        ctx.revert();
      };
    }, [applyInitialOffsets]);

    const kill = useCallback(() => {
      tlRef.current?.kill();
      tlRef.current = null;
    }, []);

    const resetAssembly = useCallback(() => {
      kill();
      applyInitialOffsets();
    }, [applyInitialOffsets, kill]);

    const startAssembly = useCallback(() => {
      const svg = svgRef.current;
      if (!svg) return;

      kill();
      applyInitialOffsets();

      const q = gsap.utils.selector(svg);
      const conduits = Array.from(
        svg.querySelectorAll<SVGPathElement>('#energy-conduits path')
      );

      const tl = gsap.timeline({
        onComplete: () => {
          onCompleteRef.current();
        },
      });

      // Subtle schematic guides appear first
      tl.to(q('#armor-hud-guides'), {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
      }, 0);

      // Step 1: Chest center panel slides in from below
      tl.to(
        q('#chest-center'),
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.42,
          ease: 'power3.out',
        },
        0.05
      ).to(
        q('#torso-collar'),
        {
          y: 0,
          opacity: 1,
          duration: 0.35,
          ease: 'power3.out',
        },
        0.18
      );

      // Step 2: Left/right chest plates + torso panels slide in from sides
      tl.to(
        q('#chest-left, #chest-right'),
        {
          x: 0,
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
        },
        0.34
      )
        .to(
          q('#torso-ab-center'),
          {
            y: 0,
            opacity: 1,
            duration: 0.4,
            ease: 'power3.out',
          },
          0.38
        )
        .to(
          q('#torso-flank-left, #torso-flank-right'),
          {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.38,
            ease: 'power3.out',
          },
          0.44
        );

      // Step 3: Shoulder components drop in from above with slight rotation
      tl.to(
        q('#shoulder-left, #shoulder-right'),
        {
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
          duration: 0.44,
          ease: 'back.out(1.2)',
        },
        0.66
      );

      // Step 4: Arm segments slide in from sides
      tl.to(
        q('#arm-left, #arm-right'),
        {
          x: 0,
          y: 0,
          opacity: 1,
          duration: 0.44,
          ease: 'power3.out',
        },
        0.92
      );

      // Step 5: Helmet panels converge from multiple directions
      tl.to(
        q('#helmet-crown'),
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: 'power3.out',
        },
        1.18
      )
        .to(
          q('#helmet-left-cheek, #helmet-right-cheek'),
          {
            x: 0,
            y: 0,
            rotation: 0,
            opacity: 1,
            duration: 0.38,
            ease: 'power3.out',
          },
          1.24
        )
        .to(
          q('#helmet-faceplate'),
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.36,
            ease: 'power3.out',
          },
          1.34
        );

      // Step 6: Energy conduit lines illuminate via stroke-dashoffset
      if (conduits.length > 0) {
        tl.to(
          conduits,
          {
            opacity: 1,
            strokeDashoffset: 0,
            duration: 0.48,
            stagger: 0.03,
            ease: 'power2.inOut',
          },
          1.55
        );
      }

      // Step 7: Visor/eye lights activate
      tl.to(
        q('#helmet-visor'),
        {
          opacity: 1,
          scale: 1,
          duration: 0.32,
          ease: 'power2.out',
        },
        1.9
      );

      tlRef.current = tl;
    }, [applyInitialOffsets, kill]);

    useImperativeHandle(
      ref,
      () => ({
        startAssembly,
        resetAssembly,
        kill,
      }),
      [startAssembly, resetAssembly, kill]
    );

    return (
      <svg
        ref={svgRef}
        viewBox="0 0 400 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full select-none pointer-events-none overflow-visible ${className}`}
        aria-hidden="true"
      >
        <defs>
          {/* Subtle Visor Activation Glow */}
          <filter id="aegis-visor-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle Conduit Glow */}
          <filter id="aegis-conduit-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Armor Metallic Depth Gradient */}
          <linearGradient id="aegis-titanium-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#26323B" />
            <stop offset="55%" stopColor="#202A32" />
            <stop offset="100%" stopColor="#161E26" />
          </linearGradient>

          <linearGradient id="aegis-graphite-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#151D26" />
            <stop offset="100%" stopColor="#0D1218" />
          </linearGradient>
        </defs>

        {/* Background Schematic Reference Guides */}
        <g id="armor-hud-guides" style={{ opacity: 0 }}>
          <line
            x1="200"
            y1="16"
            x2="200"
            y2="462"
            stroke="#53D9E8"
            strokeOpacity="0.1"
            strokeWidth="0.75"
            strokeDasharray="4 6"
          />
          <line
            x1="36"
            y1="210"
            x2="364"
            y2="210"
            stroke="#53D9E8"
            strokeOpacity="0.1"
            strokeWidth="0.75"
            strokeDasharray="4 6"
          />
          <circle
            cx="200"
            cy="210"
            r="56"
            stroke="#53D9E8"
            strokeOpacity="0.14"
            strokeWidth="0.75"
            strokeDasharray="3 5"
          />
        </g>

        {/* Cervical Collar Assembly */}
        <g id="torso-collar" style={{ opacity: 0 }}>
          <path
            d="M174 130 L226 130 L236 152 L164 152 Z"
            fill="url(#aegis-graphite-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.35"
            strokeWidth="1.1"
          />
          <line x1="184" y1="132" x2="180" y2="150" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="1" />
          <line x1="200" y1="131" x2="200" y2="150" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="1" />
          <line x1="216" y1="132" x2="220" y2="150" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="1" />
        </g>

        {/* Torso Abdominal Center Panels */}
        <g id="torso-ab-center" style={{ opacity: 0 }}>
          {/* Upper sternum-to-ab bridge */}
          <path
            d="M168 274 L232 274 L224 308 L200 318 L176 308 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
          {/* Mid abdominal chevron */}
          <path
            d="M174 313 L200 323 L226 313 L220 348 L200 356 L180 348 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.38"
            strokeWidth="1.2"
          />
          {/* Lower abdominal / pelvic core plate */}
          <path
            d="M179 354 L200 362 L221 354 L216 392 L200 404 L184 392 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.38"
            strokeWidth="1.2"
          />
          {/* Mechanical center seam & chevron details */}
          <line x1="200" y1="278" x2="200" y2="398" stroke="#A8EAF0" strokeOpacity="0.2" strokeWidth="0.9" />
          <path d="M180 288 L200 296 L220 288" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          <path d="M184 328 L200 335 L216 328" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          <path d="M187 368 L200 374 L213 368" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
        </g>

        {/* Torso Flank / Rib Panels */}
        <g id="torso-flank-left" style={{ opacity: 0 }}>
          <path
            d="M126 248 L164 260 L172 346 L146 376 L132 340 Z"
            fill="url(#aegis-graphite-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.34"
            strokeWidth="1.15"
          />
          <line x1="136" y1="274" x2="164" y2="282" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="138" y1="296" x2="166" y2="304" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="141" y1="318" x2="168" y2="326" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
        </g>

        <g id="torso-flank-right" style={{ opacity: 0 }}>
          <path
            d="M274 248 L236 260 L228 346 L254 376 L268 340 Z"
            fill="url(#aegis-graphite-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.34"
            strokeWidth="1.15"
          />
          <line x1="264" y1="274" x2="236" y2="282" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="262" y1="296" x2="234" y2="304" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="259" y1="318" x2="232" y2="326" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="1" />
        </g>

        {/* Left & Right Chest Armor Plates */}
        <g id="chest-left" style={{ opacity: 0 }}>
          <path
            d="M116 154 L164 150 L152 210 L164 254 L122 242 L106 196 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.42"
            strokeWidth="1.3"
          />
          {/* Recessed intake louver */}
          <path
            d="M122 174 L148 172 L144 192 L118 190 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />
          <line x1="120" y1="181" x2="146" y2="181" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.8" />
          <line x1="120" y1="216" x2="152" y2="224" stroke="#A8EAF0" strokeOpacity="0.22" strokeWidth="0.9" />
          <circle cx="130" cy="232" r="2" fill="#53D9E8" fillOpacity="0.45" />
        </g>

        <g id="chest-right" style={{ opacity: 0 }}>
          <path
            d="M284 154 L236 150 L248 210 L236 254 L278 242 L294 196 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.42"
            strokeWidth="1.3"
          />
          {/* Recessed intake louver */}
          <path
            d="M278 174 L252 172 L256 192 L282 190 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />
          <line x1="280" y1="181" x2="254" y2="181" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.8" />
          <line x1="280" y1="216" x2="248" y2="224" stroke="#A8EAF0" strokeOpacity="0.22" strokeWidth="0.9" />
          <circle cx="270" cy="232" r="2" fill="#53D9E8" fillOpacity="0.45" />
        </g>

        {/* Chest Center Panel with True Cutout for ReactorCore at (200, 210) */}
        <g id="chest-center" style={{ opacity: 0 }}>
          <path
            fillRule="evenodd"
            d="M164 148 L236 148 L254 192 L248 248 L228 272 L172 272 L152 248 L146 192 Z
               M158 210 A42 42 0 1 0 242 210 A42 42 0 1 0 158 210 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.48"
            strokeWidth="1.4"
          />
          {/* Chamfered Reactor Aperture Housing Ring */}
          <circle
            cx="200"
            cy="210"
            r="46"
            stroke="#53D9E8"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="10 4"
          />
          <circle
            cx="200"
            cy="210"
            r="42"
            stroke="#A8EAF0"
            strokeOpacity="0.55"
            strokeWidth="1.4"
          />
          {/* Mechanical Bezel Fasteners & Seams */}
          <line x1="176" y1="154" x2="188" y2="169" stroke="#53D9E8" strokeOpacity="0.35" strokeWidth="1" />
          <line x1="224" y1="154" x2="212" y2="169" stroke="#53D9E8" strokeOpacity="0.35" strokeWidth="1" />
          <line x1="176" y1="266" x2="188" y2="251" stroke="#53D9E8" strokeOpacity="0.35" strokeWidth="1" />
          <line x1="224" y1="266" x2="212" y2="251" stroke="#53D9E8" strokeOpacity="0.35" strokeWidth="1" />
          <circle cx="164" cy="164" r="1.8" fill="#53D9E8" fillOpacity="0.5" />
          <circle cx="236" cy="164" r="1.8" fill="#53D9E8" fillOpacity="0.5" />
          <circle cx="164" cy="256" r="1.8" fill="#53D9E8" fillOpacity="0.5" />
          <circle cx="236" cy="256" r="1.8" fill="#53D9E8" fillOpacity="0.5" />
        </g>

        {/* Left & Right Shoulder Pauldrons */}
        <g id="shoulder-left" style={{ opacity: 0 }}>
          <path
            d="M54 176 L76 140 L124 134 L138 156 L112 204 L62 208 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.46"
            strokeWidth="1.35"
          />
          <path
            d="M66 172 L84 148 L118 144 L112 164 L76 178 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.32"
            strokeWidth="0.95"
          />
          <line x1="68" y1="194" x2="106" y2="188" stroke="#A8EAF0" strokeOpacity="0.25" strokeWidth="1" />
          <circle cx="116" cy="148" r="2.2" fill="#53D9E8" fillOpacity="0.5" />
        </g>

        <g id="shoulder-right" style={{ opacity: 0 }}>
          <path
            d="M346 176 L324 140 L276 134 L262 156 L288 204 L338 208 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.46"
            strokeWidth="1.35"
          />
          <path
            d="M334 172 L316 148 L282 144 L288 164 L324 178 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.32"
            strokeWidth="0.95"
          />
          <line x1="332" y1="194" x2="294" y2="188" stroke="#A8EAF0" strokeOpacity="0.25" strokeWidth="1" />
          <circle cx="284" cy="148" r="2.2" fill="#53D9E8" fillOpacity="0.5" />
        </g>

        {/* Left & Right Arm Segments (Bicep + Elbow Actuator + Forearm Gauntlet) */}
        <g id="arm-left" style={{ opacity: 0 }}>
          {/* Upper Arm */}
          <path
            d="M58 214 L104 210 L98 294 L54 290 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.4"
            strokeWidth="1.25"
          />
          <line x1="64" y1="242" x2="96" y2="240" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          <line x1="62" y1="268" x2="94" y2="266" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          {/* Elbow Joint */}
          <circle
            cx="76"
            cy="302"
            r="10"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.45"
            strokeWidth="1.1"
          />
          <circle cx="76" cy="302" r="3.5" fill="#53D9E8" fillOpacity="0.45" />
          {/* Forearm Gauntlet */}
          <path
            d="M50 314 L94 318 L86 404 L62 414 L42 384 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.42"
            strokeWidth="1.25"
          />
          <path
            d="M56 332 L82 334 L78 378 L52 372 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />
          <line x1="56" y1="392" x2="80" y2="392" stroke="#A8EAF0" strokeOpacity="0.28" strokeWidth="1" />
        </g>

        <g id="arm-right" style={{ opacity: 0 }}>
          {/* Upper Arm */}
          <path
            d="M342 214 L296 210 L302 294 L346 290 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.4"
            strokeWidth="1.25"
          />
          <line x1="336" y1="242" x2="304" y2="240" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          <line x1="338" y1="268" x2="306" y2="266" stroke="#53D9E8" strokeOpacity="0.28" strokeWidth="0.9" />
          {/* Elbow Joint */}
          <circle
            cx="324"
            cy="302"
            r="10"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.45"
            strokeWidth="1.1"
          />
          <circle cx="324" cy="302" r="3.5" fill="#53D9E8" fillOpacity="0.45" />
          {/* Forearm Gauntlet */}
          <path
            d="M350 314 L306 318 L314 404 L338 414 L358 384 Z"
            fill="url(#aegis-titanium-grad)"
            stroke="#53D9E8"
            strokeOpacity="0.42"
            strokeWidth="1.25"
          />
          <path
            d="M344 332 L318 334 L322 378 L348 372 Z"
            fill="#111820"
            stroke="#53D9E8"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />
          <line x1="344" y1="392" x2="320" y2="392" stroke="#A8EAF0" strokeOpacity="0.28" strokeWidth="1" />
        </g>

        {/* Helmet Multi-Panel Assembly */}
        <g id="armor-helmet">
          {/* Cranial Crown */}
          <g id="helmet-crown" style={{ opacity: 0 }}>
            <path
              d="M174 42 L200 32 L226 42 L238 68 L224 78 L200 72 L176 78 L162 68 Z"
              fill="url(#aegis-titanium-grad)"
              stroke="#53D9E8"
              strokeOpacity="0.48"
              strokeWidth="1.35"
            />
            <path d="M188 38 L200 66 L212 38" stroke="#53D9E8" strokeOpacity="0.34" strokeWidth="1" />
            <line x1="168" y1="62" x2="188" y2="66" stroke="#A8EAF0" strokeOpacity="0.25" strokeWidth="0.9" />
            <line x1="232" y1="62" x2="212" y2="66" stroke="#A8EAF0" strokeOpacity="0.25" strokeWidth="0.9" />
          </g>

          {/* Left Temple & Cheek Plate */}
          <g id="helmet-left-cheek" style={{ opacity: 0 }}>
            <path
              d="M160 70 L176 78 L182 118 L170 128 L158 104 Z"
              fill="url(#aegis-titanium-grad)"
              stroke="#53D9E8"
              strokeOpacity="0.44"
              strokeWidth="1.25"
            />
            <line x1="163" y1="92" x2="176" y2="96" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="0.9" />
            <circle cx="165" cy="84" r="1.6" fill="#53D9E8" fillOpacity="0.55" />
          </g>

          {/* Right Temple & Cheek Plate */}
          <g id="helmet-right-cheek" style={{ opacity: 0 }}>
            <path
              d="M240 70 L224 78 L218 118 L230 128 L242 104 Z"
              fill="url(#aegis-titanium-grad)"
              stroke="#53D9E8"
              strokeOpacity="0.44"
              strokeWidth="1.25"
            />
            <line x1="237" y1="92" x2="224" y2="96" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="0.9" />
            <circle cx="235" cy="84" r="1.6" fill="#53D9E8" fillOpacity="0.55" />
          </g>

          {/* Central Faceplate & Jaw Mandible */}
          <g id="helmet-faceplate" style={{ opacity: 0 }}>
            <path
              d="M174 78 L200 72 L226 78 L222 108 L212 132 L200 137 L188 132 L178 108 Z"
              fill="#172029"
              stroke="#53D9E8"
              strokeOpacity="0.46"
              strokeWidth="1.3"
            />
            {/* Brow & Nasal Bridge Detail */}
            <path
              d="M196 74 L204 74 L202 106 L198 106 Z"
              fill="#202A32"
              stroke="#53D9E8"
              strokeOpacity="0.35"
              strokeWidth="0.9"
            />
            {/* Chin Plate & Vent */}
            <path
              d="M186 112 L200 118 L214 112 L209 131 L200 135 L191 131 Z"
              fill="url(#aegis-titanium-grad)"
              stroke="#53D9E8"
              strokeOpacity="0.38"
              strokeWidth="1"
            />
            <line x1="192" y1="124" x2="208" y2="124" stroke="#53D9E8" strokeOpacity="0.3" strokeWidth="0.9" />
          </g>

          {/* Visor / Optical Sensors */}
          <g id="helmet-visor" filter="url(#aegis-visor-glow)" style={{ opacity: 0 }}>
            {/* Left Eye Slit */}
            <path
              d="M173 83 L195 86 L192 91 L175 88 Z"
              fill="#A8EAF0"
              stroke="#53D9E8"
              strokeWidth="0.7"
            />
            {/* Right Eye Slit */}
            <path
              d="M227 83 L205 86 L208 91 L225 88 Z"
              fill="#A8EAF0"
              stroke="#53D9E8"
              strokeWidth="0.7"
            />
            {/* Forehead Micro Sensor */}
            <rect x="197" y="61" width="6" height="2.2" rx="1" fill="#53D9E8" />
          </g>
        </g>

        {/* Energy Conduit Network (animated with stroke-dashoffset) */}
        <g id="energy-conduits" filter="url(#aegis-conduit-glow)">
          {/* Chest -> Left Shoulder -> Left Forearm */}
          <path
            d="M156 196 L124 182 L94 166 L76 218 L72 296 L64 366"
            stroke="#53D9E8"
            strokeOpacity="0.72"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
          {/* Chest -> Right Shoulder -> Right Forearm */}
          <path
            d="M244 196 L276 182 L306 166 L324 218 L328 296 L336 366"
            stroke="#53D9E8"
            strokeOpacity="0.72"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
          {/* Core -> Collar -> Helmet Left */}
          <path
            d="M188 168 L184 142 L170 112 L166 86"
            stroke="#A8EAF0"
            strokeOpacity="0.65"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
          {/* Core -> Collar -> Helmet Right */}
          <path
            d="M212 168 L216 142 L230 112 L234 86"
            stroke="#A8EAF0"
            strokeOpacity="0.65"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
          {/* Core -> Lower Torso Left */}
          <path
            d="M178 250 L166 286 L154 338"
            stroke="#53D9E8"
            strokeOpacity="0.6"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
          {/* Core -> Lower Torso Right */}
          <path
            d="M222 250 L234 286 L246 338"
            stroke="#53D9E8"
            strokeOpacity="0.6"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0 }}
          />
        </g>
      </svg>
    );
  }
);

export default ArmorAssembly;
