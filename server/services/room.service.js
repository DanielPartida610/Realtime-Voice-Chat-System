import * as roomsStore from "../stores/room.store.js";

// ✅ Map to track users in each room
const roomUsers = new Map(); // roomId -> Map(socketId -> user)

export async function getRoomList() {
  return roomsStore.getAllRooms();
}

// ✅ ADD THIS - alias for getRoomList (used in your controller)
export async function getActiveRooms() {
  return roomsStore.getAllRooms();
}

export async function createRoom(id, name, icon) {
  return roomsStore.addRoom({ id, name, icon, users: 0 });
}

export async function updateRoomUserCount(roomId, count) {
  return roomsStore.updateUsers(roomId, count);
}

export async function deleteRoom(roomId) {
  return roomsStore.removeRoom(roomId);
}

// ✅ ADD THIS - join room and track users
export async function joinRoom(roomId, socketId, user) {
  if (!roomUsers.has(roomId)) {
    roomUsers.set(roomId, new Map());
  }
  
  const users = roomUsers.get(roomId);
  users.set(socketId, user);
  
  return Array.from(users.values());
}

// ✅ ADD THIS - leave room and update users
export async function leaveRoom(roomId, socketId) {
  if (!roomUsers.has(roomId)) {
    return [];
  }
  
  const users = roomUsers.get(roomId);
  users.delete(socketId);
  
  // Clean up empty rooms
  if (users.size === 0) {
    roomUsers.delete(roomId);
  }
  
  return Array.from(users.values());
}

// ✅ OPTIONAL - Get users in a specific room
export function getRoomUsers(roomId) {
  if (!roomUsers.has(roomId)) {
    return [];
  }
  return Array.from(roomUsers.get(roomId).values());
}