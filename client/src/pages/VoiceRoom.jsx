import { useEffect, useMemo, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import ChatBox from "../components/ChatBox";
import RemoteAudios from "../components/RemoteAudios";
import { useLocalAudio } from "../hooks/useLocalAudio";
import { useWebRTC } from "../hooks/useWebRTC";

export default function VoiceRoom({ onLeave }) {
  const socket = useSocket();

  const myName = (localStorage.getItem("vc_name") || "").trim();

  // room
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [reactions, setReactions] = useState({});

  // dm
  const [view, setView] = useState("room");
  const [activeDMUser, setActiveDMUser] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmReactions, setDmReactions] = useState({});

  // ui
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // voice
  const [muted, setMuted] = useState(false);
  const { stream: localStream } = useLocalAudio();
  const { remoteStreams } = useWebRTC(socket, localStream, users);

  const joined = useMemo(() => users.length > 0, [users.length]);

  // Helper: normalize names for comparison
  const normalizeName = (name) => (name || "").trim().toLowerCase();

  // keep mic track synced
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [localStream, muted]);

  // NEW: Track known users and save to localStorage
  const [knownUsers, setKnownUsers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vc_known_users") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const newNames = users.map(u => u.user?.name).filter(Boolean);
    
    setKnownUsers(prev => {
      const combined = [...new Set([...prev, ...newNames])];
      // Remove self from known users
      const filtered = combined.filter(n => normalizeName(n) !== normalizeName(myName));
      localStorage.setItem("vc_known_users", JSON.stringify(filtered));
      return filtered;
    });
  }, [users, myName]);

  // listeners
  useEffect(() => {
    const onUsers = (list) => setUsers(Array.isArray(list) ? list : []);
    const onHistory = (history) => Array.isArray(history) && setMessages(history);
    const onMessage = (msg) => setMessages((p) => [...p, msg]);

    const onTypingStatus = ({ socketId, user, isTyping }) => {
      setTypingMap((prev) => {
        const next = { ...prev };
        if (isTyping) next[socketId] = user;
        else delete next[socketId];
        return next;
      });
    };

    const onDMHistory = ({ history }) => Array.isArray(history) && setDmMessages(history);
    const onDMMessage = (msg) => setDmMessages((p) => [...p, msg]);

    // Reaction handlers
    const onReaction = ({ messageId, emoji, user }) => {
      setReactions((prev) => {
        const msgReacts = prev[messageId] || {};
        const emojiUsers = msgReacts[emoji] || [];
        
        if (emojiUsers.includes(user)) {
          // Remove reaction
          const filtered = emojiUsers.filter(u => u !== user);
          if (filtered.length === 0) {
            const { [emoji]: _, ...rest } = msgReacts;
            if (Object.keys(rest).length === 0) {
              const { [messageId]: __, ...restMsgs } = prev;
              return restMsgs;
            }
            return { ...prev, [messageId]: rest };
          }
          return { ...prev, [messageId]: { ...msgReacts, [emoji]: filtered } };
        } else {
          // Add reaction
          return {
            ...prev,
            [messageId]: { ...msgReacts, [emoji]: [...emojiUsers, user] }
          };
        }
      });
    };

    const onDMReaction = ({ messageId, emoji, user }) => {
      setDmReactions((prev) => {
        const msgReacts = prev[messageId] || {};
        const emojiUsers = msgReacts[emoji] || [];
        
        if (emojiUsers.includes(user)) {
          const filtered = emojiUsers.filter(u => u !== user);
          if (filtered.length === 0) {
            const { [emoji]: _, ...rest } = msgReacts;
            if (Object.keys(rest).length === 0) {
              const { [messageId]: __, ...restMsgs } = prev;
              return restMsgs;
            }
            return { ...prev, [messageId]: rest };
          }
          return { ...prev, [messageId]: { ...msgReacts, [emoji]: filtered } };
        } else {
          return {
            ...prev,
            [messageId]: { ...msgReacts, [emoji]: [...emojiUsers, user] }
          };
        }
      });
    };

    socket.on("room:users", onUsers);
    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:typing:status", onTypingStatus);
    socket.on("chat:reaction", onReaction);

    socket.on("dm:history", onDMHistory);
    socket.on("dm:message", onDMMessage);
    socket.on("dm:reaction", onDMReaction);

    return () => {
      socket.off("room:users", onUsers);
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:typing:status", onTypingStatus);
      socket.off("chat:reaction", onReaction);

      socket.off("dm:history", onDMHistory);
      socket.off("dm:message", onDMMessage);
      socket.off("dm:reaction", onDMReaction);
    };
  }, [socket]);

  // typing text only for room
  const typingUsers = [...new Set(Object.values(typingMap))].filter(Boolean);
  const typingText = typingUsers.length ? `${typingUsers.join(", ")} typing…` : "";

  // time formatting
  const roomUIMessages = messages.map((m) => ({
    ...m,
    time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "",
  }));

  const dmUIMessages = dmMessages.map((m) => ({
    ...m,
    time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : "",
  }));

  const displayMessages = view === "dm" ? dmUIMessages : roomUIMessages;
  const displayReactions = view === "dm" ? dmReactions : reactions;

  // send message
  const sendMessage = (text) => {
    if (!joined) return alert("Join a room first");

    if (view === "dm") {
      if (!activeDMUser) return alert("Pick a user to DM");
      if (normalizeName(activeDMUser) === normalizeName(myName)) {
        return alert("You can't DM yourself! 😭");
      }
      socket.emit("dm:send", { toUser: activeDMUser, text });
      return;
    }

    socket.emit("chat:send", { text });
  };

  // handle reactions
  const handleReact = (messageId, emoji) => {
    if (!joined) return;

    if (view === "dm") {
      if (!activeDMUser) return;
      socket.emit("dm:react", { toUser: activeDMUser, messageId, emoji });
      return;
    }

    socket.emit("chat:react", { messageId, emoji });
  };

  // typing only in room
  const setTyping = (isTyping) => {
    if (!joined) return;
    if (view !== "room") return;
    socket.emit("chat:typing", { isTyping });
  };

  // open dm
  const openDM = (name) => {
    if (!name) return;
    
    if (normalizeName(name) === normalizeName(myName)) {
      return alert("You can't DM yourself! 😭");
    }
    
    setView("dm");
    setActiveDMUser(name);
    setDmMessages([]);
    setSidebarOpen(false);
    socket.emit("dm:history", { toUser: name });
  };

  const openRoom = () => {
    setView("room");
    setActiveDMUser(null);
    setSidebarOpen(false);
  };

  // mute
  const toggleMute = () => {
    if (!localStream) return alert("Mic not ready yet");

    setMuted((prev) => {
      const next = !prev;
      socket.emit("presence:mute", { muted: next });
      return next;
    });
  };

  // ✅ FIXED: Proper disconnect function
  const handleDisconnect = () => {
    if (confirm("Are you sure you want to leave the room?")) {
      // 1. Stop local audio tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // 2. Emit room:leave event to server (triggers cleanup on server)
      socket.emit("room:leave");

      // 3. Clear local state immediately
      setUsers([]);
      setMessages([]);
      setTypingMap({});
      setReactions({});
      setDmMessages([]);
      setDmReactions({});
      setView("room");
      setActiveDMUser(null);

      // 4. Disconnect socket after a brief delay to let server process
      setTimeout(() => {
        socket.disconnect();
        
        // 5. Call parent callback to show join screen
        onLeave?.();
      }, 150);
    }
  };

  // FIXED: Create online users set for O(1) lookup
  const onlineUsersSet = useMemo(() => {
    const names = users.map(u => u.user?.name).filter(Boolean);
    return new Set(names.map(n => normalizeName(n)));
  }, [users]);

  // Helper to check if user is online
  const isUserOnline = (name) => onlineUsersSet.has(normalizeName(name));

  // FIXED: Use known users (not just online users) for DM list
  const dmUsers = useMemo(() => {
    return [...new Set(knownUsers)].filter(n => normalizeName(n) !== normalizeName(myName));
  }, [knownUsers, myName]);

  return (
    <div className="appShell">
      <div className="serverBar">
        <div className={`serverDot ${view === "room" ? "active" : ""}`} onClick={openRoom}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
        </div>
        <div className="serverDot add">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
      </div>

      {sidebarOpen ? <div className="backdrop" onClick={() => setSidebarOpen(false)} /> : null}

      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebarHeader">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: 8}}>
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
          VoiceChat
        </div>

        <div className="sidebarScroll">
          <div className="sectionLabel">TEXT CHANNELS</div>
          <div className={`userItem channelItem ${view === "room" ? "active" : ""}`} onClick={openRoom}>
            <div className="channelIcon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 13h14v-2H5v2zm0 4h14v-2H5v2zM5 7v2h14V7H5z"/>
              </svg>
            </div>
            <div className="userName">general</div>
          </div>

          <div className="sectionLabel">DIRECT MESSAGES</div>
          {dmUsers.length === 0 && (
            <div style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: "13px" }}>
              No users available
            </div>
          )}
          {dmUsers.map((name) => {
            const isOnline = isUserOnline(name);
            const isActive = view === "dm" && normalizeName(activeDMUser) === normalizeName(name);
            
            return (
              <div
                className={`userItem ${isActive ? "active" : ""}`}
                key={name}
                onClick={() => openDM(name)}
              >
                <div className="avatar">
                  {name.slice(0, 2).toUpperCase()}
                  <div className={`statusDot ${isOnline ? "online" : "offline"}`} />
                </div>
                <div className="userMeta">
                  <div className="userName">{name}</div>
                  <div className="userStatus">
                    {isActive ? "Active" : isOnline ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="voicePanel">
          <div className="voiceHeader">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.5 12c0 2.76-2.24 5-5 5s-5-2.24-5-5h-2c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
            <span style={{marginLeft: 8}}>Voice Connected</span>
          </div>
          
          <div className="voiceStatus">
            {localStream ? (
              muted ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#ed4245">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                  <span style={{color: "#ed4245", marginLeft: 6}}>Muted</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#3ba55d">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  </svg>
                  <span style={{color: "#3ba55d", marginLeft: 6}}>Connected</span>
                </>
              )
            ) : (
              <span style={{color: "#faa81a"}}>Connecting...</span>
            )}
          </div>

          <div className="voiceControls">
            <button className="voiceBtn" onClick={toggleMute} title={muted ? "Unmute" : "Mute"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {muted ? (
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                ) : (
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                )}
              </svg>
            </button>

            {/* ✅ Disconnect button */}
            <button 
              className="voiceBtn" 
              onClick={handleDisconnect} 
              title="Leave Room"
              style={{background: 'var(--danger)'}}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
            </button>
          </div>

          <RemoteAudios remoteStreams={remoteStreams} />
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <button
            className="menuBtn"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>

          <div className="channelInfo">
            {view === "room" ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{marginRight: 8}}>
                  <path d="M5 13h14v-2H5v2zm0 4h14v-2H5v2zM5 7v2h14V7H5z"/>
                </svg>
                <span className="channelTitle">general</span>
              </>
            ) : (
              <>
                <div className="avatar small">
                  {(activeDMUser || "?").slice(0, 2).toUpperCase()}
                  <div className={`statusDot ${isUserOnline(activeDMUser) ? "online" : "offline"}`} />
                </div>
                <span className="channelTitle">{activeDMUser || "dm"}</span>
              </>
            )}
          </div>

          {/* ✅ Disconnect button in topbar for mobile */}
          <button 
            className="voiceBtn topbar-disconnect" 
            onClick={handleDisconnect} 
            title="Leave Room"
            style={{
              marginLeft: 'auto',
              background: 'var(--danger)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </div>

        <ChatBox
          messages={displayMessages}
          onSend={sendMessage}
          onTyping={view === "room" ? setTyping : undefined}
          typingText={view === "room" ? typingText : ""}
          onReact={handleReact}
          reactions={displayReactions}
          isDM={view === "dm"}
          dmUser={activeDMUser || ""}
          myName={myName}
        />
      </div>

      {/* ✅ Mobile disconnect button CSS */}
      <style>{`
        .topbar-disconnect {
          display: none;
        }
        
        @media (max-width: 768px) {
          .topbar-disconnect {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}