import { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import ChatBox from "../components/ChatBox";
import RemoteAudios from "../components/RemoteAudios";
import { useLocalAudio } from "../hooks/useLocalAudio";
import { useWebRTC } from "../hooks/useWebRTC";
import { useVoiceCall } from "../hooks/useVoiceCall";

export default function VoiceRoom({ roomId = "general", roomName = "General", onLeave }) {
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

  // ✅ GLOBAL CALL HANDLER - Always active
  const handleCallLog = (logData) => {
    console.log("📞 Call log:", logData);
    
    // Send call log message to chat
    const callMessage = formatCallMessage(logData);
    if (callMessage && socket && logData.peer) {
      socket.emit("dm:send", { 
        toUser: logData.peer, 
        text: callMessage,
        type: "call-log" 
      });
    }
  };

  const call = useVoiceCall({ socket, myName, onCallLog: handleCallLog });

  // ✅ Format call log message
  const formatCallMessage = (logData) => {
    const { type, direction, duration, timestamp } = logData;
    
    const getTime = () => {
      if (timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      }
      return new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };
    
    if (type === "missed") {
      return direction === "outgoing" 
        ? `📞 Missed call (no answer)` 
        : `📞 Missed call`;
    }
    
    if (type === "rejected") {
      return direction === "outgoing"
        ? `📞 Call declined`
        : `📞 Call rejected`;
    }
    
    if (type === "answered") {
      const time = getTime();
      return direction === "outgoing"
        ? `📞 Outgoing call answered • ${time}`
        : `📞 Incoming call answered • ${time}`;
    }
    
    if (type === "ended") {
      if (duration && duration > 0) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return `📞 Call ended • Duration: ${timeStr}`;
      }
      return `📞 Call ended`;
    }
    
    return null;
  };

  // ✅ Auto-open DM when accepting call
  const handleAcceptCall = async () => {
    const peerName = call.peer;
    console.log("🎯 Accepting call from:", peerName);

    if (!peerName) {
      console.error("❌ No peer name available!");
      return;
    }

    // ✅ Accept the call
    await call.acceptCall();

    // ✅ Small delay to let WebRTC connection establish before switching view
    setTimeout(() => {
      console.log("🎯 Opening DM with:", peerName);
      openDM(peerName);
    }, 500);
  };

  const joined = useMemo(() => users.length > 0, [users.length]);

  // ✅ JOIN GUARD - prevents repeated joins
  const joinedRef = useRef(false);

  // Helper: normalize names for comparison
  const normalizeName = (name) => (name || "").trim().toLowerCase();

  // ✅ JOIN THE SELECTED ROOM (with guard)
  useEffect(() => {
    if (!socket || !roomId || !myName) return;

    if (joinedRef.current) return;
    joinedRef.current = true;

    console.log("🚪 Joining room:", roomId);
    
    socket.emit("room:join", {
      roomId: roomId,
      user: { name: myName },
    });

    return () => {
      console.log("👋 Leaving room:", roomId);
      joinedRef.current = false;
    };
  }, [socket, roomId, myName]);

  // keep mic track synced
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [localStream, muted]);

  // ✅ Track known users for persistent DM list
  const [knownUsers, setKnownUsers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vc_known_users") || "[]");
    } catch {
      return [];
    }
  });

  // ✅ Update known users with proper structure handling
  useEffect(() => {
    const newNames = users
      .map(u => u?.user?.name || u?.name)
      .filter(Boolean)
      .map(n => n.trim());
    
    setKnownUsers(prev => {
      const combined = [...new Set([...prev, ...newNames])];
      const filtered = combined.filter(n => normalizeName(n) !== normalizeName(myName));
      localStorage.setItem("vc_known_users", JSON.stringify(filtered));
      
      console.log("📋 Known users updated:", filtered);
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

  // send voice message
  const sendVoiceMessage = (voiceData) => {
    console.log("📨 VoiceRoom received voice data:", voiceData);
    
    if (!joined) {
      alert("Join a room first");
      return;
    }

    if (view === "dm") {
      if (!activeDMUser) {
        alert("Pick a user to DM");
        return;
      }
      if (normalizeName(activeDMUser) === normalizeName(myName)) {
        alert("You can't DM yourself! 😭");
        return;
      }
      
      console.log("📤 Emitting dm:send:voice to:", activeDMUser);
      socket.emit("dm:send:voice", { 
        toUser: activeDMUser, 
        ...voiceData 
      });
      console.log("✅ Voice DM sent");
      return;
    }

    console.log("📤 Emitting chat:send:voice to room");
    socket.emit("chat:send:voice", voiceData);
    console.log("✅ Voice message sent to room");
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

  // disconnect function
  const handleDisconnect = () => {
    if (confirm("Are you sure you want to leave the room?")) {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      socket.emit("room:leave");

      setUsers([]);
      setMessages([]);
      setTypingMap({});
      setReactions({});
      setDmMessages([]);
      setDmReactions({});
      setView("room");
      setActiveDMUser(null);

      setTimeout(() => {
        socket.disconnect();
        onLeave?.();
      }, 150);
    }
  };

  // ✅ Create online users set with proper normalization
  const onlineUsersSet = useMemo(() => {
    const names = users
      .map((u) => u?.user?.name || u?.name)
      .filter(Boolean)
      .map((n) => (n || "").trim().toLowerCase());

    return new Set(names);
  }, [users]);

  // ✅ Helper to check if user is online
  const isUserOnline = (name) =>
    onlineUsersSet.has((name || "").trim().toLowerCase());

  // ✅ Use knownUsers with fallback to current online users
  const dmUsers = useMemo(() => {
    const allUsers = [...new Set([...knownUsers, ...Array.from(onlineUsersSet)])];
    return allUsers.filter(n => normalizeName(n) !== normalizeName(myName));
  }, [knownUsers, onlineUsersSet, myName]);

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
            <div className="userName">{roomName}</div>
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
            const isCalling = call.state === "ringing" && normalizeName(call.peer) === normalizeName(name);
            
            return (
              <div
                className={`userItem ${isActive ? "active" : ""} ${isCalling ? "calling" : ""}`}
                key={name}
                onClick={() => openDM(name)}
              >
                {isCalling && (
                  <div className="callingBadge">📞</div>
                )}
                <div className="avatar">
                  {name.slice(0, 2).toUpperCase()}
                  <div className={`statusDot ${isOnline ? "online" : "offline"}`} />
                </div>
                <div className="userMeta">
                  <div className="userName">{name}</div>
                  <div className="userStatus">
                    {isCalling ? "Calling..." : isActive ? "Active" : isOnline ? "Online" : "Offline"}
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
                <span className="channelTitle">{roomName}</span>
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

          <div className="currentUserBadge">
            <div className="avatar tiny">
              {myName.slice(0, 2).toUpperCase()}
            </div>
            <span className="currentUserName">{myName}</span>
          </div>

          <button 
            className="voiceBtn topbar-disconnect" 
            onClick={handleDisconnect} 
            title="Leave Room"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </div>

        <ChatBox
          socket={socket}
          messages={displayMessages}
          onSend={sendMessage}
          onSendVoice={sendVoiceMessage}
          onTyping={view === "room" ? setTyping : undefined}
          typingText={view === "room" ? typingText : ""}
          onReact={handleReact}
          reactions={displayReactions}
          isDM={view === "dm"}
          dmUser={activeDMUser || ""}
          myName={myName}
          call={call}
        />
      </div>

      {/* ✅ GLOBAL INCOMING CALL POPUP */}
      {call.state === "ringing" && (
        <div className="callOverlay" onClick={(e) => e.target.className === "callOverlay" && call.rejectCall()}>
          <div className="callPopup">
            <div className="callHeader">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#3ba55d">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
              </svg>
              <div className="callTitle">Incoming Call</div>
            </div>
            
            <div className="callPeer">
              <div className="avatar">
                {(call.peer || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="peerName">{call.peer}</div>
            </div>

            <div className="callActions">
              <button className="callBtn reject" onClick={call.rejectCall}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
                Decline
              </button>
              
              <button className="callBtn accept" onClick={handleAcceptCall}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ===== GLOBAL CALL POPUP ===== */
        .callOverlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 80px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 10000;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .callPopup {
          background: var(--bg-secondary);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 24px;
          min-width: 320px;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .callHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .callTitle {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-normal);
        }

        .callPeer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }

        .callPeer .avatar {
          width: 64px;
          height: 64px;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
        }

        .peerName {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-normal);
        }

        .callActions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .callBtn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .callBtn:active {
          transform: scale(0.96);
        }

        .callBtn.reject {
          background: #ed4245;
          color: white;
        }

        .callBtn.reject:hover {
          background: #c9393c;
        }

        .callBtn.accept {
          background: #3ba55d;
          color: white;
        }

        .callBtn.accept:hover {
          background: #2d7d46;
        }

        /* ✅ Calling badge in sidebar */
        .userItem {
          position: relative;
        }

        .callingBadge {
          position: absolute;
          top: 8px;
          right: 8px;
          font-size: 14px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }

        .userItem.calling {
          background: rgba(88, 101, 242, 0.15);
          border-left: 3px solid #5865f2;
        }

        /* ===== USER BADGE STYLING ===== */
        .currentUserBadge {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          margin-right: 12px;
          padding: 6px 12px;
          background: rgba(88, 101, 242, 0.1);
          border-radius: 16px;
          border: 1px solid rgba(88, 101, 242, 0.2);
        }

        .currentUserName {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-normal);
        }

        .avatar.tiny {
          width: 24px;
          height: 24px;
          font-size: 10px;
          font-weight: 700;
        }

        .topbar-disconnect {
          background: var(--danger);
          margin-left: 0;
        }

        /* ===== MOBILE IMPROVEMENTS ===== */
        @media (max-width: 768px) {
          .callOverlay {
            padding-top: 60px;
          }

          .callPopup {
            margin: 0 16px;
            min-width: auto;
            width: calc(100% - 32px);
          }

          .callPeer .avatar {
            width: 56px;
            height: 56px;
            font-size: 20px;
          }

          .peerName {
            font-size: 18px;
          }

          .callBtn {
            padding: 12px 16px;
            font-size: 14px;
          }

          .currentUserName {
            display: none;
          }

          .currentUserBadge {
            padding: 6px;
            margin-right: 8px;
            background: transparent;
            border: none;
          }

          .topbar-disconnect {
            display: flex !important;
          }

          .topbar {
            padding: 12px;
            gap: 8px;
          }

          .channelInfo {
            flex: 1;
            min-width: 0;
          }

          .channelTitle {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sidebar {
            width: 280px;
          }

          .sidebar.open {
            width: 280px;
          }

          .voicePanel {
            padding: 12px;
          }

          .voiceControls {
            gap: 8px;
          }

          .voiceBtn {
            flex: 1;
            min-width: 0;
          }

          .sidebarScroll {
            -webkit-overflow-scrolling: touch;
          }

          .avatar {
            width: 36px;
            height: 36px;
            font-size: 14px;
          }

          .avatar.small {
            width: 28px;
            height: 28px;
            font-size: 12px;
          }

          .userItem {
            padding: 10px 12px;
          }

          .userName {
            font-size: 15px;
          }

          .userStatus {
            font-size: 12px;
          }

          .sectionLabel {
            font-size: 11px;
            padding: 16px 12px 8px;
          }

          .menuBtn {
            padding: 8px;
          }

          .statusDot {
            width: 10px;
            height: 10px;
            border-width: 2px;
          }
        }

        @media (max-width: 400px) {
          .sidebar {
            width: 260px;
          }

          .sidebar.open {
            width: 260px;
          }

          .sidebarHeader {
            font-size: 15px;
            padding: 14px 12px;
          }

          .voiceHeader {
            font-size: 12px;
          }

          .voiceStatus {
            font-size: 12px;
          }

          .currentUserBadge .avatar.tiny {
            width: 28px;
            height: 28px;
            font-size: 11px;
          }
        }

        @media (max-width: 768px) and (orientation: landscape) {
          .sidebar {
            width: 240px;
          }

          .sidebar.open {
            width: 240px;
          }

          .voicePanel {
            padding: 8px;
          }

          .sectionLabel {
            padding: 12px 8px 6px;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .currentUserBadge {
            padding: 8px 14px;
          }

          .currentUserName {
            font-size: 15px;
          }
        }

        @media (hover: none) and (pointer: coarse) {
          .userItem,
          .channelItem,
          .voiceBtn,
          .menuBtn,
          .serverDot {
            min-height: 44px;
            min-width: 44px;
          }

          .userItem,
          .channelItem,
          .voiceBtn,
          .menuBtn,
          .serverDot,
          .currentUserBadge {
            -webkit-user-select: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }

          .userItem:active,
          .channelItem:active {
            transform: scale(0.98);
            transition: transform 0.1s;
          }

          .voiceBtn:active {
            transform: scale(0.95);
            transition: transform 0.1s;
          }
        }
      `}</style>
    </div>
  );
}