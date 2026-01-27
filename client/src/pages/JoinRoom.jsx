import { useState } from "react";
import { useSocket } from "../hooks/useSocket";

export default function JoinRoom({ onJoin }) {
  const socket = useSocket();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("room-1");

  const join = () => {
    if (!name.trim()) return alert("Enter your name");

    // ✅ CRITICAL FIX: Save to localStorage so VoiceRoom can identify you
    localStorage.setItem("vc_name", name.trim());

    socket.emit("room:join", {
      roomId,
      user: { name: name.trim() },
    });

    onJoin?.();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") join();
  };

  return (
    <div style={styles.container}>
      {/* Left Panel - Branding */}
      <div style={styles.leftPanel}>
        <div style={styles.logoSection}>
          <div style={styles.logo}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </div>
          <h1 style={styles.brandTitle}>VoiceChat</h1>
          <p style={styles.brandSubtitle}>Connect • Chat • Collaborate</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          <h2 style={styles.title}>Welcome back!</h2>
          <p style={styles.subtitle}>We're so excited to see you again!</p>

          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                DISPLAY NAME <span style={{color: '#f04747'}}>*</span>
              </label>
              <input
                style={styles.input}
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
                maxLength={20}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>
                ROOM ID <span style={{color: '#f04747'}}>*</span>
              </label>
              <input
                style={styles.input}
                placeholder="room-1"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={handleKeyPress}
                maxLength={30}
              />
            </div>

            <button 
              style={styles.button}
              onClick={join}
            >
              Join
            </button>

            <div style={styles.hint}>
              Need an invite? Ask your friends for a room ID
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input:focus {
          outline: none;
          border-color: #5865f2 !important;
        }

        button:hover {
          background: #4752c4 !important;
        }

        button:active {
          transform: translateY(1px);
        }

        @media (max-width: 768px) {
          .leftPanel { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    background: "#313338",
  },
  leftPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    background: "#5865f2",
  },
  logoSection: {
    textAlign: "center",
    maxWidth: "400px",
  },
  logo: {
    width: "100px",
    height: "100px",
    margin: "0 auto 30px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(10px)",
  },
  brandTitle: {
    fontSize: "48px",
    fontWeight: "800",
    color: "white",
    margin: "0 0 16px",
    letterSpacing: "-1px",
  },
  brandSubtitle: {
    fontSize: "18px",
    color: "rgba(255, 255, 255, 0.8)",
    margin: 0,
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    background: "#313338",
  },
  formCard: {
    background: "#313338",
    borderRadius: "8px",
    padding: "32px",
    width: "100%",
    maxWidth: "480px",
    animation: "fadeIn 0.4s ease",
  },
  title: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#f2f3f5",
    margin: "0 0 8px",
    textAlign: "center",
  },
  subtitle: {
    fontSize: "16px",
    color: "#b5bac1",
    margin: "0 0 20px",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#b5bac1",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "10px",
    fontSize: "16px",
    border: "1px solid #1e1f22",
    borderRadius: "4px",
    background: "#1e1f22",
    color: "#dbdee1",
    transition: "border-color 0.2s ease",
    fontFamily: "inherit",
  },
  button: {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    fontWeight: "600",
    color: "white",
    background: "#5865f2",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    marginTop: "8px",
  },
  hint: {
    fontSize: "14px",
    color: "#949ba4",
    textAlign: "center",
  },
};