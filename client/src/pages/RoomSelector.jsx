import { useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";

export default function RoomSelector({ onRoomSelect }) {
  const socket = useSocket();
  const [rooms, setRooms] = useState([
    { id: "general", name: "General", icon: "💬", users: 0 },
    { id: "gaming", name: "Gaming", icon: "🎮", users: 0 },
    { id: "music", name: "Music", icon: "🎵", users: 0 },
  ]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💬");

  const emojis = ["💬", "🎮", "🎵", "📚", "💼", "🎨", "🏃", "🍕", "✨", "🔥", "❤️", "🎧"];

  // Listen for room list updates
  useEffect(() => {
    const onRoomList = (roomList) => {
      console.log("📋 Received room list:", roomList);
      if (Array.isArray(roomList)) {
        setRooms(roomList);
      }
    };

    // Request initial room list
    socket.emit("rooms:list");
    
    // Listen for updates
    socket.on("rooms:list", onRoomList);

    return () => {
      socket.off("rooms:list", onRoomList);
    };
  }, [socket]);

  const createRoom = () => {
    const name = newRoomName.trim();
    if (!name) return alert("Please enter a room name");
    if (name.length > 30) return alert("Room name too long (max 30 characters)");

    const roomId = name.toLowerCase().replace(/\s+/g, "-");
    
    // Check if room already exists
    if (rooms.some(r => r.id === roomId)) {
      return alert("A room with this name already exists!");
    }

    const newRoom = {
      id: roomId,
      name: name,
      icon: selectedEmoji,
      users: 0,
    };

    // Add room locally
    setRooms(prev => [...prev, newRoom]);
    
    // Emit to server (if you want to persist rooms)
    socket.emit("rooms:create", newRoom);

    // Reset form
    setNewRoomName("");
    setSelectedEmoji("💬");
    setShowCreateRoom(false);

    // Auto-join the new room
    onRoomSelect(roomId, name);
  };

  const joinRoom = (roomId, roomName) => {
    onRoomSelect(roomId, roomName);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </div>
        <h1 style={styles.title}>Select a Room</h1>
        <p style={styles.subtitle}>Join a voice channel to get started</p>
      </div>

      {/* Room List */}
      <div style={styles.roomList}>
        {rooms.map((room) => (
          <div
            key={room.id}
            style={styles.roomCard}
            onClick={() => joinRoom(room.id, room.name)}
          >
            <div style={styles.roomIcon}>{room.icon}</div>
            <div style={styles.roomInfo}>
              <div style={styles.roomName}>{room.name}</div>
              <div style={styles.roomUsers}>
                {room.users || 0} {room.users === 1 ? "user" : "users"} online
              </div>
            </div>
            <div style={styles.joinArrow}>→</div>
          </div>
        ))}

        {/* Create Room Button */}
        <div
          style={styles.createRoomCard}
          onClick={() => setShowCreateRoom(true)}
        >
          <div style={styles.createIcon}>+</div>
          <div style={styles.createText}>Create New Room</div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateRoom(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create a Room</h2>
              <button 
                style={styles.closeBtn}
                onClick={() => setShowCreateRoom(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Room Name</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g., Study Group, Chill Zone"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={30}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === "Enter") createRoom();
                  }}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Choose an Icon</label>
                <div style={styles.emojiGrid}>
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      style={{
                        ...styles.emojiOption,
                        ...(selectedEmoji === emoji ? styles.emojiSelected : {})
                      }}
                      onClick={() => setSelectedEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button style={styles.createButton} onClick={createRoom}>
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#313338",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
  },
  header: {
    textAlign: "center",
    marginBottom: "40px",
  },
  logo: {
    width: "80px",
    height: "80px",
    margin: "0 auto 20px",
    background: "#5865f2",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#f2f3f5",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: "16px",
    color: "#b5bac1",
    margin: 0,
  },
  roomList: {
    width: "100%",
    maxWidth: "600px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  roomCard: {
    background: "#2b2d31",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    animation: "slideUp 0.3s ease",
  },
  roomIcon: {
    fontSize: "32px",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#313338",
    borderRadius: "8px",
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#f2f3f5",
    marginBottom: "4px",
  },
  roomUsers: {
    fontSize: "14px",
    color: "#80848e",
  },
  joinArrow: {
    fontSize: "24px",
    color: "#5865f2",
    opacity: 0,
    transition: "opacity 0.2s ease",
  },
  createRoomCard: {
    background: "transparent",
    border: "2px dashed #5865f2",
    borderRadius: "8px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginTop: "8px",
  },
  createIcon: {
    fontSize: "32px",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#5865f2",
    borderRadius: "8px",
    color: "white",
    fontWeight: "bold",
  },
  createText: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#5865f2",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    animation: "fadeIn 0.2s ease",
  },
  modal: {
    background: "#313338",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "500px",
    animation: "slideUp 0.3s ease",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderBottom: "1px solid #404249",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#f2f3f5",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#b5bac1",
    fontSize: "32px",
    cursor: "pointer",
    padding: "0",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "all 0.15s ease",
  },
  modalBody: {
    padding: "24px",
  },
  inputGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "700",
    color: "#b5bac1",
    textTransform: "uppercase",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    background: "#1e1f22",
    border: "1px solid #1e1f22",
    borderRadius: "4px",
    color: "#dbdee1",
    outline: "none",
    transition: "border-color 0.2s ease",
    fontFamily: "inherit",
  },
  emojiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: "8px",
  },
  emojiOption: {
    fontSize: "24px",
    padding: "12px",
    background: "#1e1f22",
    border: "2px solid transparent",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  emojiSelected: {
    background: "#5865f2",
    borderColor: "#5865f2",
    transform: "scale(1.1)",
  },
  createButton: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    fontWeight: "600",
    background: "#5865f2",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginTop: "8px",
  },
};