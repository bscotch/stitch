import { chatSchemaId } from './cl2.shared.types.js';
import type { GameChanger } from './GameChanger.js';
import { createBsArrayKey } from './helpers.js';
import type { Mote } from './types.js';

export {
  parseStringifiedChat,
  updateChangesFromParsedChat,
} from './cl2.chat.parse.js';
export { stringifyChat } from './cl2.chat.stringify.js';
export {
  isChatMote,
  listChats,
  type ChatUpdateResult,
} from './cl2.chat.types.js';

export async function createChatMote(
  packed: GameChanger,
  parent?: Mote,
  folder?: string,
) {
  console.log('CREATING CHAT MOTE', { parent, folder });
  const mote = packed.createMote(chatSchemaId, createBsArrayKey(6));
  packed.updateMoteData(mote.id, 'data/wip/staging', 'Draft');
  packed.updateMoteData(mote.id, 'data/name', '');
  packed.updateMoteLocation(mote.id, parent?.id, folder);
  // Add an initial, empty Moment so there's something already there to edit from
  const momentId = createBsArrayKey();
  const phraseId = createBsArrayKey();
  // Note that this will only get written to disk if the user opens and saves the Chat. Just a helper to get them started while in the editor!
  packed.updateMoteData(
    mote.id,
    `data/moments/${momentId}/element/${phraseId}/element/speaker`,
    '',
  );
  await packed.writeChanges();
  return mote;
}
