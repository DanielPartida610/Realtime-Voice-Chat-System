import * as store from "../stores/chat.store.js";

export async function addChat(roomId, message) {
  await store.pushMessage(roomId, message);
}

export async function getChatHistory(roomId) {
  return store.getHistory(roomId);
}