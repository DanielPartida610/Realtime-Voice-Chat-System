import { getReactions, setReactions } from "../stores/reactions.store.js";

export async function toggleReaction(roomId, messageId, emoji, userName) {
  const all = await getReactions(roomId);

  all[messageId] ||= {};
  all[messageId][emoji] ||= [];

  const arr = all[messageId][emoji];
  const idx = arr.indexOf(userName);

  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(userName);

  // cleanup empty
  if (all[messageId][emoji].length === 0) delete all[messageId][emoji];
  if (Object.keys(all[messageId]).length === 0) delete all[messageId];

  await setReactions(roomId, all);
  return all;
}