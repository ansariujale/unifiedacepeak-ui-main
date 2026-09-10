/**
 * The right-hand pane shown for the Website tab when nothing is selected —
 * a browser-window illustration with a live chat bubble exchange, handwritten
 * annotations, and the four things this pane does. Inline SVG/CSS, no image
 * asset to ship.
 */
const WebsiteEmptyState = () => {
  const tiles = [
    {
      bg: '#fde3ea',
      fg: '#e0507a',
      title: 'Talk to Customers',
      sub: 'Respond to website enquiries in real time.',
      icon: (
        <path
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H9l-3.2 2.4a.5.5 0 0 1-.8-.4V13h-.5A1.5 1.5 0 0 1 3 11.5v-6Z"
          fill="currentColor"
        />
      ),
    },
    {
      bg: '#e3e6fb',
      fg: '#5a5fd6',
      title: 'View Customer Info',
      sub: 'See past conversations and details.',
      icon: (
        <>
          <circle cx="7" cy="7.4" r="2.4" fill="currentColor" />
          <circle cx="13.2" cy="7.4" r="2.4" fill="currentColor" opacity="0.6" />
          <path d="M2.5 16c.6-2.7 2.7-4.1 5-4.1s4.4 1.4 5 4.1H2.5Z" fill="currentColor" />
          <path d="M9.7 12.2c1.9.4 3.4 1.7 3.9 3.8h4c-.5-2.3-2.2-3.6-4.1-4-1.2.4-2.5.4-3.8.2Z" fill="currentColor" opacity="0.6" />
        </>
      ),
    },
    {
      bg: '#d8f3e4',
      fg: '#2f9e63',
      title: 'Create Actions',
      sub: 'Send links, share files or create tickets.',
      icon: (
        <path
          d="M11.6 3.2a1.6 1.6 0 0 1 2.3 0l2.9 2.9a1.6 1.6 0 0 1 0 2.3l-6.1 6.1-5.4.9.9-5.4 5.4-5.8Zm.9 2.1 3 3"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ),
    },
    {
      bg: '#fbe6cf',
      fg: '#d4842e',
      title: 'Track Performance',
      sub: 'Turn conversations into opportunities.',
      icon: (
        <path
          d="M4 15.5V11m4.5 4.5V7.5M13 15.5v-6M17 15.5V4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden bg-white">
      {/* soft background wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-1/3 h-96 w-96 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, #fbd7de 0%, rgba(251,215,222,0) 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[2%] top-1/4 h-64 w-64 rounded-full opacity-50 blur-2xl"
        style={{ background: 'radial-gradient(circle, #e3e6fb 0%, rgba(227,230,251,0) 70%)' }}
      />

      <div className="relative z-10 grid w-full grid-cols-1 items-center gap-10 px-8 lg:grid-cols-2 lg:px-14">
        {/* left: copy + feature list */}
        <div className="max-w-md">
          <h2 className="text-[26px] font-extrabold leading-tight text-gray-900">Welcome to</h2>
          <h2
            className="text-[30px] italic leading-tight text-gray-900"
            style={{ fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif" }}
          >
            Website Chat
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Select a conversation from the left to view messages, reply to customers, or take
            action.
          </p>

          <div className="mt-7 flex flex-col gap-5">
            {tiles.map((tile) => (
              <div key={tile.title} className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: tile.bg, color: tile.fg }}
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5">
                    {tile.icon}
                  </svg>
                </span>
                <div>
                  <div className="text-[14px] font-bold text-gray-900">{tile.title}</div>
                  <div className="text-[12.5px] text-gray-500">{tile.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right: browser mockup + chat bubbles + handwritten annotations */}
        <div className="relative hidden lg:block">
          <svg viewBox="0 0 420 340" className="h-auto w-full" role="img" aria-label="Website chat preview">
            {/* handwritten annotation: top */}
            <text
              x="150"
              y="40"
              fontSize="14"
              fill="#4b5563"
              fontStyle="italic"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
              transform="rotate(-6 150 40)"
            >
              Conversations
            </text>
            <text
              x="150"
              y="58"
              fontSize="14"
              fill="#4b5563"
              fontStyle="italic"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
              transform="rotate(-6 150 58)"
            >
              create opportunities
            </text>
            <path
              d="M150 66 q-24 14 -30 34"
              fill="none"
              stroke="#9aa3b8"
              strokeWidth="1.3"
              strokeDasharray="1 4"
              strokeLinecap="round"
              markerEnd="url(#ac-arrow)"
            />

            {/* exclamation accent */}
            <g transform="translate(372 92) rotate(18)">
              <rect x="0" y="0" width="4" height="16" rx="2" fill="#ec6e8c" />
              <rect x="10" y="10" width="4" height="8" rx="2" fill="#ec6e8c" />
            </g>

            {/* browser window */}
            <g transform="translate(70 78)">
              <rect x="0" y="0" width="290" height="190" rx="14" fill="#ffffff" stroke="#eceef7" strokeWidth="1.5" />
              <rect x="0" y="0" width="290" height="30" rx="14" fill="#f7f8fc" />
              <rect x="0" y="16" width="290" height="14" fill="#f7f8fc" />
              <circle cx="16" cy="15" r="4" fill="#f28b82" />
              <circle cx="30" cy="15" r="4" fill="#fbbc57" />
              <circle cx="44" cy="15" r="4" fill="#8bcf8f" />

              {/* left rail */}
              <g transform="translate(14 42)">
                {[0, 1, 2, 3].map((i) => (
                  <g key={i} transform={`translate(0 ${i * 30})`}>
                    <circle cx="10" cy="10" r="10" fill="#eef0f7" />
                    <rect x="28" y="4" width="60" height="5" rx="2.5" fill="#eef0f7" />
                    <rect x="28" y="14" width="40" height="4" rx="2" fill="#f4f5fa" />
                  </g>
                ))}
              </g>

              {/* divider */}
              <line x1="128" y1="30" x2="128" y2="190" stroke="#f0f1f7" strokeWidth="1.5" />

              {/* chat area */}
              <g transform="translate(140 46)">
                {/* visitor bubble */}
                <rect x="18" y="0" width="118" height="26" rx="13" fill="#dce7fe" />
                <text x="30" y="17" fontSize="10" fill="#26364d">
                  Hello! I have a question
                </text>
                <circle cx="146" cy="13" r="12" fill="#e3e6fb" />
                <circle cx="146" cy="10" r="4" fill="#6b6fd8" />
                <path d="M139 19c1.4-3.4 4-5 7-5s5.6 1.6 7 5" fill="#6b6fd8" />

                {/* bot bubble */}
                <circle cx="12" cy="52" r="12" fill="#fddbe0" />
                <circle cx="12" cy="52" r="7.5" fill="#ec6e8c" />
                <circle cx="9" cy="50" r="1.3" fill="#fff" />
                <circle cx="15" cy="50" r="1.3" fill="#fff" />
                <path d="M8.5 54.5c1 1 4 1 5 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" />
                <rect x="30" y="40" width="120" height="30" rx="14" fill="#ffffff" stroke="#f0f1f7" strokeWidth="1.5" />
                <text x="42" y="55" fontSize="10" fontWeight="700" fill="#111827">
                  Hi there! 👋
                </text>
                <text x="42" y="67" fontSize="9.5" fill="#6b7280">
                  How can we help you today?
                </text>
              </g>

              {/* footer input bar */}
              <rect x="14" y="168" width="262" height="12" rx="6" fill="#f4f5fa" />
            </g>

            {/* plant */}
            <g transform="translate(24 210)">
              <path d="M24 92 q-16 -40 6 -60 q12 26 -6 60Z" fill="#7fc99a" />
              <path d="M34 92 q2 -46 26 -54 q-4 34 -26 54Z" fill="#5fb583" />
              <path d="M16 92 q-4 -30 12 -40 q6 20 -12 40Z" fill="#8fd4a8" />
              <path d="M6 128h56l-7 -32h-42Z" fill="#ffffff" stroke="#eceef7" strokeWidth="1.5" />
            </g>

            {/* handwritten annotation: bottom */}
            <text
              x="330"
              y="270"
              fontSize="14"
              fill="#4b5563"
              fontStyle="italic"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
              transform="rotate(-4 330 270)"
            >
              Support
            </text>
            <text
              x="322"
              y="288"
              fontSize="14"
              fill="#4b5563"
              fontStyle="italic"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
              transform="rotate(-4 322 288)"
            >
              grows business
            </text>
            <path
              d="M366 250 q14 8 18 24"
              fill="none"
              stroke="#9aa3b8"
              strokeWidth="1.3"
              strokeDasharray="1 4"
              strokeLinecap="round"
              markerEnd="url(#ac-arrow)"
            />

            <defs>
              <marker id="ac-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0 0 L6 3 L0 6 Z" fill="#9aa3b8" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default WebsiteEmptyState;
