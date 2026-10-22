const MAX_STREAMS_PER_USER = 5;
const HEARTBEAT_MS = 25000;

const streams = new Map(); // userId -> Set<res>
let heartbeat = null;

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const set of streams.values()) for (const res of set) res.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();
}

/** Registers an open SSE response for a signed-in user. */
export function addStream(userId, res) {
  let set = streams.get(userId);
  if (!set) streams.set(userId, (set = new Set()));
  if (set.size >= MAX_STREAMS_PER_USER) {
    const oldest = set.values().next().value;
    oldest.end();
    set.delete(oldest);
  }
  set.add(res);
  startHeartbeat();
  res.on('close', () => {
    set.delete(res);
    if (set.size === 0) streams.delete(userId);
  });
}

/** Pushes one event to every open stream of the user. Offline users read stored notifications instead. */
export function sendToUser(userId, event, data) {
  const set = streams.get(userId);
  if (!set) return 0;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(frame);
  return set.size;
}

export function closeAllStreams() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const set of streams.values()) for (const res of set) res.end();
  streams.clear();
}
