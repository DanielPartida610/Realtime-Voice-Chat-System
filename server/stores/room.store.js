import { redisPub as r } from "../config/redis.js";

const ROOMS_KEY = "app:rooms";

// Default rooms
const defaultRooms = [
  { id: "general", name: "General", icon: "💬", users: 0 },
  { id: "gaming", name: "Gaming", icon: "🎮", users: 0 },
  { id: "music", name: "Music", icon: "🎵", users: 0 },
];

export async function getAllRooms() {
  const roomsData = await r.get(ROOMS_KEY);
  
  if (!roomsData) {
    // Initialize with defaults
    await r.set(ROOMS_KEY, JSON.stringify(defaultRooms));
    return defaultRooms;
  }
  
  try {
    return JSON.parse(roomsData);
  } catch (err) {
    console.error("Failed to parse rooms data:", err);
    return defaultRooms;
  }
}

export async function addRoom(room) {
  const rooms = await getAllRooms();
  
  // Check if room already exists
  if (rooms.some(r => r.id === room.id)) {
    console.log("Room already exists:", room.id);
    return rooms;
  }
  
  rooms.push(room);
  await r.set(ROOMS_KEY, JSON.stringify(rooms));
  console.log("✅ Room added to Redis:", room.name);
  return rooms;
}

export async function updateUsers(roomId, count) {
  const rooms = await getAllRooms();
  const room = rooms.find(r => r.id === roomId);
  
  if (room) {
    room.users = count;
    await r.set(ROOMS_KEY, JSON.stringify(rooms));
    console.log(`📊 Updated ${roomId} user count: ${count}`);
  }
  
  return rooms;
}

export async function removeRoom(roomId) {
  const rooms = await getAllRooms();
  const filtered = rooms.filter(r => r.id !== roomId);
  
  await r.set(ROOMS_KEY, JSON.stringify(filtered));
  console.log("🗑️ Room removed:", roomId);
  return filtered;
}