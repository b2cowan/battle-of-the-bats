/**
 * TOURNAMENT CHAT (THE ORGANIZER'S), IN WORDS — Tournament admin redesign Stage 5 (E11, A57; hub v45, ruled as drawn
 * 2026-10-10; the words are /marketing's, `.probe/s5b/words-final.md` §11). The page gets its title band; the room is
 * chosen by the olive pill on a phone and a docked column at a desk; Manage room keeps its panel. The browser's own
 * confirm and prompt boxes (close, rename, delete, a name already taken) are the product's windows now.
 *
 * Pure, so a plain Node unit test reads it.
 */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const CHAT_WORDS = {
  title: 'Chat',
  manage: 'Manage room',
  rooms: 'Rooms',
  newRoom: 'New room',
  allCoachesLine: 'Every coach with a team in this tournament',
  /** The composer's hint names who a message reaches (hub v45's "Write to all coaches", 2026-10-18). */
  writeTo: (room: { refSubId: string | null; name: string }) =>
    room.refSubId == null ? 'Write to all coaches…' : `Write to ${room.name}…`,
  divisionRoom: 'Division room',
  coaches: (n: number) => plural(n, 'coach', 'coaches'),
  notJoined: (n: number) => `${n} not joined`,
  reported: (n: number) => plural(n, 'reported message', 'reported messages'),
  loading: 'Loading chat…',
  loadFailed: 'The chat didn’t load.',
  noAccess: 'You don’t have access to chat moderation.',
  noTournament: 'Select a tournament to manage its chat.',
  selectRoom: 'Select a room.',
  // Close / reopen
  closeTitle: (room: string) => `Close ${room}?`,
  closeBody: 'Coaches can still read it, but can’t post until you reopen it.',
  closeAction: 'Close room',
  // Rename
  renameTitle: 'Rename room',
  roomName: 'Room name',
  rename: 'Rename',
  renameAnyway: 'Rename anyway',
  // Delete
  deleteTitle: (room: string) => `Delete ${room}?`,
  deleteBody: 'It has no messages. This can’t be undone; the All coaches room is unaffected.',
  deleteAction: 'Delete room',
  // A name already in use (F5: warn, never block)
  takenTitle: (name: string) => `A room named “${name}” already exists`,
  takenBody: 'Coaches won’t be able to tell the two apart.',
  createAnyway: 'Create anyway',
  keep: 'Keep it',
  cancel: 'Cancel',
  // Failures, in the page (never a browser alert)
  updateFailed: 'Couldn’t update the room. Nothing was changed.',
  memberFailed: 'Couldn’t update the member. Nothing was changed.',
  removeFailed: 'Couldn’t remove the message.',
  reportFailed: 'Couldn’t update the report.',
  renameFailed: 'Couldn’t rename the room.',
  deleteFailed: 'Couldn’t delete the room.',
  createFailed: 'Couldn’t create the room.',
} as const;
