export const BEFORE_TRICK_POWER_IDS = [
  'cinderella',
  'pocahontas',
  'pea-princess',
  'little-mermaid',
  'sleeping-beauty',
  'scheherazade',
  'ice-princess',
  'rapunzel'
] as const;

export type BeforeTrickPowerId = typeof BEFORE_TRICK_POWER_IDS[number];

export type BeforeTrickWindow = {
  id: string;
  startingLeaderUid: string;
  eligibleUids: string[];
  priorityUid: string;
  actedUids: string[];
  declinedSinceActivation: string[];
};

export function isBeforeTrickPower(powerId?: string): powerId is BeforeTrickPowerId {
  return BEFORE_TRICK_POWER_IDS.includes(powerId as BeforeTrickPowerId);
}

function firstFrom(playerUids: string[], startingUid: string, eligibleUids: string[], includeStart: boolean): string | null {
  if (!eligibleUids.length || !playerUids.length) return null;
  const startIndex = Math.max(0, playerUids.indexOf(startingUid));
  for (let offset = includeStart ? 0 : 1; offset <= playerUids.length; offset += 1) {
    const uid = playerUids[(startIndex + offset) % playerUids.length];
    if (eligibleUids.includes(uid)) return uid;
  }
  return null;
}

export function createBeforeTrickWindow(id: string, playerUids: string[], leaderUid: string, eligibleUids: string[]): BeforeTrickWindow | null {
  const priorityUid = firstFrom(playerUids, leaderUid, eligibleUids, true);
  return priorityUid ? { id, startingLeaderUid: leaderUid, eligibleUids: [...eligibleUids], priorityUid, actedUids: [], declinedSinceActivation: [] } : null;
}

export function declineBeforeTrickPriority(window: BeforeTrickWindow, playerUids: string[], actorUid: string): BeforeTrickWindow | null {
  if (window.priorityUid !== actorUid || window.actedUids.includes(actorUid)) return window;
  const remaining = window.eligibleUids.filter((uid) => !window.actedUids.includes(uid));
  const declinedSinceActivation = window.declinedSinceActivation.includes(actorUid)
    ? window.declinedSinceActivation
    : [...window.declinedSinceActivation, actorUid];
  if (remaining.every((uid) => declinedSinceActivation.includes(uid))) return null;
  const priorityUid = firstFrom(playerUids, actorUid, remaining, false);
  return priorityUid ? { ...window, priorityUid, declinedSinceActivation } : null;
}

export function completeBeforeTrickPower(window: BeforeTrickWindow, playerUids: string[], actorUid: string): BeforeTrickWindow | null {
  if (window.priorityUid !== actorUid || window.actedUids.includes(actorUid)) return window;
  const actedUids = [...window.actedUids, actorUid];
  const remaining = window.eligibleUids.filter((uid) => !actedUids.includes(uid));
  if (!remaining.length) return null;
  const priorityUid = firstFrom(playerUids, actorUid, remaining, false);
  return priorityUid ? { ...window, priorityUid, actedUids, declinedSinceActivation: [] } : null;
}
