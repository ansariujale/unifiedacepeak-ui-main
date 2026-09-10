/**
 * The right-hand pane shown for the All Channels tab when nothing is
 * selected — a "Stay connected" pill, a gradient headline, four tinted
 * action cards, a closing quote pill, and an illustration of two contact
 * cards orbited by a dashed arrow with a paper-plane, plus handwritten
 * annotations. Inline SVG/CSS, no image asset to ship.
 */
const AllChannelsEmptyState = () => {
  const cards = [
    {
      bg: 'linear-gradient(180deg,#fdeef1 0%,#fff 100%)',
      iconBg: '#fbd7de',
      fg: '#e0507a',
      title: 'View Messages',
      sub: 'Read and respond to customer queries.',
      icon: (
        <path
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H9l-3.2 2.4a.5.5 0 0 1-.8-.4V13h-.5A1.5 1.5 0 0 1 3 11.5v-6Z"
          fill="currentColor"
        />
      ),
    },
    {
      bg: 'linear-gradient(180deg,#eeeefb 0%,#fff 100%)',
      iconBg: '#e3e6fb',
      fg: '#5a5fd6',
      title: 'Customer Details',
      sub: 'See contact information.',
      icon: (
        <>
          <circle cx="10" cy="7.2" r="2.6" fill="currentColor" />
          <path d="M4 16c.7-3 3.1-4.6 6-4.6s5.3 1.6 6 4.6H4Z" fill="currentColor" />
        </>
      ),
    },
    {
      bg: 'linear-gradient(180deg,#e9f8ef 0%,#fff 100%)',
      iconBg: '#d8f3e4',
      fg: '#2f9e63',
      title: 'Conversation History',
      sub: 'Track all previous interactions.',
      icon: (
        <path
          d="M6 3h6l3 3v10.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V3.5A.5.5 0 0 1 6 3Zm5.5.6V6a1 1 0 0 0 1 1h2.4M7.5 10h5M7.5 12.3h5M7.5 14.6h3"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ),
    },
    {
      bg: 'linear-gradient(180deg,#fdf2e6 0%,#fff 100%)',
      iconBg: '#fbe6cf',
      fg: '#d4842e',
      title: 'Take Action',
      sub: 'Call, SMS or add a note.',
      icon: (
        <path
          d="M12.1 3.3 16.7 8l-7 7-4.6.6.6-4.6 6.4-6.7Zm2.9-1.1 1.8 1.8-1.5 1.5-1.8-1.8 1.5-1.5Z"
          fill="currentColor"
        />
      ),
    },
  ];

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden bg-white">
      {/* soft background washes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, #e3e6fb 0%, rgba(227,230,251,0) 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, #fbd7de 0%, rgba(251,215,222,0) 70%)' }}
      />
      <svg aria-hidden className="pointer-events-none absolute right-0 top-0 h-28 w-28 opacity-40" viewBox="0 0 100 100">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 6 }).map((__, col) => (
            <circle key={`${row}-${col}`} cx={6 + col * 16} cy={6 + row * 16} r="1.6" fill="#c9cff0" />
          )),
        )}
      </svg>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-8 py-10 lg:px-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          {/* left: copy */}
          <div className="max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Stay connected
            </span>

            <h2 className="mt-3 text-[30px] font-extrabold leading-[1.15] text-gray-900">
              Your Conversations
              <br />
              Start{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg,#ec4899,#a855f7)' }}
              >
                Here
              </span>
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Choose a conversation from the left to view messages, continue the conversation, or
              take action.
            </p>
          </div>

          {/* right: illustration */}
          <div className="relative hidden lg:block">
            <svg viewBox="0 0 320 190" className="h-auto w-full" role="img" aria-label="Stay connected">
              {/* handwritten annotation: top */}
              <text x="196" y="18" fontSize="11" fill="#6b7280" fontStyle="italic">
                Messages
              </text>
              <text x="196" y="32" fontSize="11" fill="#6b7280" fontStyle="italic">
                build relationships
              </text>
              <path
                d="M240 36 q-14 10 -20 26"
                fill="none"
                stroke="#c7cbe0"
                strokeWidth="1.2"
                strokeDasharray="1 4"
                strokeLinecap="round"
                markerEnd="url(#stayc-arrow)"
              />

              {/* exclamation accent */}
              <g transform="translate(18 20) rotate(-10)">
                <rect x="0" y="0" width="3.5" height="14" rx="1.75" fill="#ec6e8c" />
                <rect x="8" y="9" width="3.5" height="7" rx="1.75" fill="#ec6e8c" />
              </g>

              {/* dashed orbit */}
              <ellipse
                cx="120"
                cy="95"
                rx="86"
                ry="46"
                fill="none"
                stroke="#f0b8cb"
                strokeWidth="1.4"
                strokeDasharray="4 5"
              />

              {/* back card: purple contact */}
              <g transform="translate(56 46)">
                <rect x="0" y="0" width="150" height="46" rx="14" fill="#ffffff" stroke="#eceafb" strokeWidth="1.5" />
                <circle cx="24" cy="23" r="11" fill="#e3e6fb" />
                <circle cx="24" cy="19.5" r="4" fill="#6b6fd8" />
                <path d="M15.5 29c1.6-4 4.6-6 8.5-6s6.9 2 8.5 6" fill="#6b6fd8" />
                <rect x="46" y="14" width="86" height="6" rx="3" fill="#e2e4f7" />
                <rect x="46" y="26" width="62" height="6" rx="3" fill="#eef0fb" />
              </g>

              {/* front card: pink contact */}
              <g transform="translate(70 82)">
                <rect x="0" y="0" width="150" height="46" rx="14" fill="#ffffff" stroke="#f6e2e8" strokeWidth="1.5" />
                <circle cx="24" cy="23" r="11" fill="#fbd7de" />
                <circle cx="24" cy="19.5" r="4" fill="#e0507a" />
                <path d="M15.5 29c1.6-4 4.6-6 8.5-6s6.9 2 8.5 6" fill="#e0507a" />
                <rect x="46" y="14" width="86" height="6" rx="3" fill="#f6d9e0" />
                <rect x="46" y="26" width="62" height="6" rx="3" fill="#fbeaee" />
              </g>

              {/* paper plane */}
              <g transform="translate(226 70) rotate(18)">
                <path d="M0 20 L38 0 L16 38 L11 22 Z" fill="#ec6e8c" />
                <path d="M0 20 L16 22 L11 38 Z" fill="#d84d70" />
              </g>

              {/* handwritten annotation: bottom */}
              <text x="210" y="150" fontSize="11" fill="#6b7280" fontStyle="italic">
                Faster support
              </text>
              <text x="204" y="164" fontSize="11" fill="#6b7280" fontStyle="italic">
                happier customers
              </text>
              <path
                d="M240 128 q10 10 6 24"
                fill="none"
                stroke="#c7cbe0"
                strokeWidth="1.2"
                strokeDasharray="1 4"
                strokeLinecap="round"
                markerEnd="url(#stayc-arrow)"
              />

              <defs>
                <marker id="stayc-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0 0 L6 3 L0 6 Z" fill="#c7cbe0" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>

        {/* four tinted action cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-black/5 p-4 shadow-[0_1px_3px_rgba(17,17,17,0.05)]"
              style={{ background: card.bg }}
            >
              <span
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: card.iconBg, color: card.fg }}
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5">
                  {card.icon}
                </svg>
              </span>
              <div className="text-[13.5px] font-bold text-gray-900">{card.title}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-gray-500">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* closing quote pill */}
        <div className="mt-7 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-4 py-2 text-[12.5px] text-gray-500">
            💡 Great conversations lead to loyal customers.
          </span>
        </div>
      </div>
    </div>
  );
};

export default AllChannelsEmptyState;
