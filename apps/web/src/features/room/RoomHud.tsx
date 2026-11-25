const peers = [
  { name: 'Ploy (speaking)', initial: 'P', tone: 'ploy' },
  { name: 'Fern', initial: 'F', tone: 'fern' },
  { name: 'Ken', initial: 'K', tone: 'ken' },
];

export function RoomHud({
  playerName,
  onLeave,
  livePeers,
}: {
  playerName: string;
  onLeave: () => void;
  livePeers?: [string, string][];
}) {
  const visiblePeers = livePeers
    ? livePeers.slice(0, 3).map(([id, name], i) => ({
        id,
        name,
        initial: Array.from(name)[0]?.toUpperCase(),
        tone: peers[i].tone,
      }))
    : peers.map((peer) => ({ ...peer, id: peer.name }));
  const initial = Array.from(playerName)[0]?.toLocaleUpperCase();
  const count = (livePeers?.length ?? peers.length) + 1;
  return (
    <header className="room-hud">
      <div className="room-identity">
        <button
          type="button"
          className="room-leave"
          aria-label="Leave"
          title="Leave room"
          onClick={onLeave}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5H4v14h5m5-14 7 7-7 7M8 12h13" />
          </svg>
        </button>
        <div>
          <h1>Study Room</h1>
          <p className="room-meta">
            <span className="room-online" aria-hidden="true" />
            <span>Cosy Library · {count} here</span>
            <svg
              className="room-voice-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              role="img"
              aria-label="Proximity voice"
            >
              <path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" />
            </svg>
          </p>
        </div>
      </div>
      <div className="room-presence" role="img" aria-label={count + ' people in the room'}>
        <div className="room-avatars" aria-hidden="true">
          {visiblePeers.map((peer) => (
            <span
              className={'room-avatar room-avatar-' + peer.tone}
              key={peer.id}
              title={peer.name}
            >
              {peer.initial}
            </span>
          ))}
          <span className="room-avatar room-avatar-self" title={playerName + ' (you)'}>
            {initial}
          </span>
        </div>
        <span className="room-count" aria-hidden="true">
          {count}
        </span>
      </div>
    </header>
  );
}
