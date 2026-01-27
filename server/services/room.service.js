import * as roomStore from "../stores/room.store.js";

export async function joinRoom(roomId, socketId, user) {
  await roomStore.addUser(roomId, socketId, user);
  return roomStore.getUsers(roomId);
}

export async function leaveRoom(roomId, socketId) {
  await roomStore.removeUser(roomId, socketId);
  return roomStore.getUsers(roomId);
}

export async function getActiveRooms() {
  return roomStore.listActiveRooms();
}