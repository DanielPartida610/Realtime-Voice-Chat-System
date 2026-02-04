import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useVoiceCall } from "../hooks/usevoiceCall";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

const EMOJIS = ["😀", "😂", "🥹", "🔥", "❤️", "👍", "🎧", "🎙️", "✨", "😤"];
const REACTS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

export default function ChatBox({
  socket,
  messages,
  onSend,
  onSendVoice,
  onTyping,
  typingText,
  onReact,
  reactions = {},
  isDM = false,
  dmUser = "",
  myName = "",
  roomName = "", // Add room name for non-DM messages
}) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder();

  // ✅ Debug: confirm socket is reaching ChatBox
  useEffect(() => {
    console.log("🔌 ChatBox socket:", socket?.id, socket);
  }, [socket]);

  // ✅ Voice Call Hook with call logging
  const handleCallLog = (logData) => {
    console.log("📞 Call log:", logData);
    
    // Send call log message to chat
    const callMessage = formatCallMessage(logData);
    if (callMessage && socket) {
      socket.emit("dm:send", { 
        toUser: dmUser, 
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    onTyping?.(false);
  };

  // ✅ File upload handlers
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log("📤 Uploading file:", file.name, file.type, file.size);

      // Upload to Cloudinary with progress tracking
      const uploaded = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
      });

      console.log("✅ Upload successful:", uploaded);

      // ✅ FIXED: Send file message properly through socket
      const fileMessage = {
        type: "file",
        url: uploaded.secure_url,
        name: uploaded.original_filename || file.name,
        mimeType: file.type,
        size: uploaded.size,
        width: uploaded.width,
        height: uploaded.height,
        category: uploaded.category,
      };

      console.log("📨 Sending file message:", fileMessage);

      if (isDM && dmUser && socket) {
        // ✅ DM: Send directly via socket
        socket.emit("dm:send", {
          toUser: dmUser,
          ...fileMessage,
        });
        console.log("✅ File sent to DM:", dmUser);
      } else if (socket) {
        // ✅ Room message: Send via socket
        socket.emit("message:send", {
          room: roomName || "general",
          ...fileMessage,
        });
        console.log("✅ File sent to room:", roomName || "general");
      } else if (onSend) {
        // ✅ Fallback: Use onSend callback
        onSend(fileMessage);
        console.log("✅ File sent via onSend callback");
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setUploadProgress(0);
      setIsUploading(false);
    } catch (err) {
      console.error("❌ Upload failed:", err);
      setUploadError(err.message);
      setIsUploading(false);
      setUploadProgress(0);

      // Auto-clear error after 5 seconds
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  // Voice recording handlers
  const handleVoiceStart = () => startRecording();

  const handleVoiceSend = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    if (onSendVoice) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];

        onSendVoice({
          audio: base64,
          duration: recordingTime,
          mimeType: blob.type,
        });
      };
      reader.readAsDataURL(blob);
    }
  };

  const handleVoiceCancel = () => cancelRecording();

  // ✅ Play voice message with amplification (Web Audio API)
  const playVoiceMessage = async (mimeType, base64Audio) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 3.0;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.start(0);

      source.onended = () => {
        audioContext.close();
      };
    } catch (err) {
      console.error("Failed to play audio:", err);
      alert("Failed to play audio: " + err.message);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  const normalizeName = (name) => (name || "").trim().toLowerCase();
  const placeholder = isDM ? `Message @${dmUser || "dm"}` : "Message #general";

  return (
    <>
      {/* ✅ DM CALL BAR with duration */}
      {isDM && dmUser && (
        <div className="dmCallBar">
          <div className="dmCallTitle">Chat with @{dmUser}</div>

          {!socket && <div style={{ opacity: 0.7 }}>Connecting…</div>}

          {socket && call.state === "idle" && (
            <button className="callBtn" onClick={() => call.startCall(dmUser)}>
              📞 Call
            </button>
          )}

          {socket && call.state === "calling" && (
            <div className="callStatus">
              Calling @{dmUser}...
              <button className="endBtn" onClick={call.endCall}>
                End
              </button>
            </div>
          )}

          {socket && call.state === "ringing" && (
            <div className="callStatus">
              📞 Incoming call from @{call.peer}
              <button className="acceptBtn" onClick={call.acceptCall}>
                Accept
              </button>
              <button className="rejectBtn" onClick={call.rejectCall}>
                Reject
              </button>
            </div>
          )}

          {socket && call.state === "in-call" && (
            <div className="callStatus">
              <div className="callInfo">
                🔊 In call with @{call.peer}
                <span className="callTimer">{call.callDuration}</span>
              </div>
              <button className="muteBtn" onClick={call.toggleMute}>
                {call.isMuted ? "🔇 Unmute" : "🔊 Mute"}
              </button>
              <button className="endBtn" onClick={call.endCall}>
                End
              </button>
            </div>
          )}
        </div>
      )}

      <div className="chatArea">
        {messages.map((m) => {
          if (m.type === "system") {
            return (
              <div key={m.id} className="systemMsg">
                <div className="systemLine" />
                <span className="systemText">{m.text}</span>
                <div className="systemLine" />
              </div>
            );
          }

          // ✅ Special rendering for call log messages
          if (m.type === "call-log") {
            return (
              <div key={m.id} className="callLogMsg">
                <div className="callLogBadge">
                  {m.text}
                </div>
                {m.time && <div className="callLogTime">{m.time}</div>}
              </div>
            );
          }

          // ✅ File message rendering
          if (m.type === "file") {
            const isMe = myName && m.user && normalizeName(m.user) === normalizeName(myName);
            const initials = (m.user || "?").slice(0, 2).toUpperCase();
            const msgReacts = reactions?.[m.id] || {};
            const hasReactions = Object.keys(msgReacts).length > 0;
            const isImage = m.mimeType && m.mimeType.startsWith("image/");

            return (
              <div key={m.id} className={`chatRow ${isMe ? "me" : "other"}`}>
                {!isMe && (
                  <div className="chatAvatar" title={m.user}>
                    {initials}
                  </div>
                )}

                <div className="chatContent">
                  {!isMe && (
                    <div className="chatMeta">
                      <span className="chatName">{m.user}</span>
                      {m.time && <span className="msgTime">{m.time}</span>}
                    </div>
                  )}

                  <div className={`chatBubble ${isMe ? "myBubble" : "otherBubble"}`}>
                    <div className="fileMessage">
                      {isImage ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="fileImageLink">
                          <img src={m.url} alt={m.name} className="fileImage" />
                        </a>
                      ) : (
                        <a href={m.url} target="_blank" rel="noreferrer" className="fileLink">
                          <span className="fileIcon">📄</span>
                          <div className="fileInfo">
                            <div className="fileName">{m.name}</div>
                            <div className="fileSize">{formatFileSize(m.size)}</div>
                          </div>
                        </a>
                      )}
                    </div>

                    {isMe && m.time && <div className="msgTime myTime">{m.time}</div>}
                  </div>

                  {hasReactions && (
                    <div className="reactionsDisplay">
                      {Object.entries(msgReacts).map(([emoji, users]) =>
                        users.length > 0 ? (
                          <button
                            key={emoji}
                            className={`reactionBubble ${
                              users.some((u) => normalizeName(u) === normalizeName(myName))
                                ? "myReaction"
                                : ""
                            }`}
                            onClick={() => onReact?.(m.id, emoji)}
                            title={users.join(", ")}
                          >
                            <span className="reactionEmoji">{emoji}</span>
                            <span className="reactionCount">{users.length}</span>
                          </button>
                        ) : null
                      )}
                    </div>
                  )}

                  {onReact && (
                    <div className="addReaction">
                      {REACTS.map((emoji) => (
                        <button
                          key={emoji}
                          className="quickReact"
                          onClick={() => onReact(m.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isMe && (
                  <div className="chatAvatar myAvatar" title="You">
                    {initials}
                  </div>
                )}
              </div>
            );
          }

          const isMe = myName && m.user && normalizeName(m.user) === normalizeName(myName);
          const initials = (m.user || "?").slice(0, 2).toUpperCase();

          const msgReacts = reactions?.[m.id] || {};
          const hasReactions = Object.keys(msgReacts).length > 0;

          return (
            <div key={m.id} className={`chatRow ${isMe ? "me" : "other"}`}>
              {!isMe && (
                <div className="chatAvatar" title={m.user}>
                  {initials}
                </div>
              )}

              <div className="chatContent">
                {!isMe && (
                  <div className="chatMeta">
                    <span className="chatName">{m.user}</span>
                    {m.time && <span className="msgTime">{m.time}</span>}
                  </div>
                )}

                <div className={`chatBubble ${isMe ? "myBubble" : "otherBubble"}`}>
                  {m.type === "voice" ? (
                    <div className="voiceMessage">
                      <button
                        className="voicePlayBtn"
                        onClick={() => playVoiceMessage(m.mimeType, m.audio)}
                      >
                        ▶
                      </button>
                      <div className="voiceWaveform">
                        <div className="voiceDuration">{formatTime(m.duration || 0)}</div>
                        <div className="waveformBars">
                          {[...Array(20)].map((_, i) => (
                            <div
                              key={i}
                              className="waveBar"
                              style={{ height: `${Math.random() * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="chatText">{m.text}</div>
                  )}

                  {isMe && m.time && <div className="msgTime myTime">{m.time}</div>}
                </div>

                {hasReactions && (
                  <div className="reactionsDisplay">
                    {Object.entries(msgReacts).map(([emoji, users]) =>
                      users.length > 0 ? (
                        <button
                          key={emoji}
                          className={`reactionBubble ${
                            users.some((u) => normalizeName(u) === normalizeName(myName))
                              ? "myReaction"
                              : ""
                          }`}
                          onClick={() => onReact?.(m.id, emoji)}
                          title={users.join(", ")}
                        >
                          <span className="reactionEmoji">{emoji}</span>
                          <span className="reactionCount">{users.length}</span>
                        </button>
                      ) : null
                    )}
                  </div>
                )}

                {onReact && (
                  <div className="addReaction">
                    {REACTS.map((emoji) => (
                      <button
                        key={emoji}
                        className="quickReact"
                        onClick={() => onReact(m.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isMe && (
                <div className="chatAvatar myAvatar" title="You">
                  {initials}
                </div>
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      <div className="chatComposer">
        {!isRecording && (
          <div className="emojiBar">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="emojiBtn"
                onClick={() => setText((t) => t + e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {isRecording && (
          <div className="recordingBar">
            <button className="cancelRecordBtn" onClick={handleVoiceCancel}>
              ✖
            </button>

            <div className="recordingInfo">
              <div className="recordingIndicator">
                <div className="recordingDot" />
                <span className="recordingTime">{formatTime(recordingTime)}</span>
              </div>
            </div>

            <button className="sendRecordBtn" onClick={handleVoiceSend}>
              ➤
            </button>
          </div>
        )}

        {!isRecording && (
          <div className="composerBox">
            {/* ✅ File upload button */}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              id="fileUpload"
              onChange={handleFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />

            <button 
              className="attachBtn" 
              onClick={handleFileClick}
              disabled={isUploading}
              title="Attach file"
            >
              {isUploading ? "📤" : "📎"}
            </button>

            <input
              className="composerInput"
              value={text}
              placeholder={placeholder}
              onChange={(e) => {
                setText(e.target.value);
                onTyping?.(true);
              }}
              onBlur={() => onTyping?.(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={isUploading}
            />

            {text.trim() ? (
              <button className="sendBtn" onClick={send} disabled={isUploading}>
                ➤
              </button>
            ) : (
              <button 
                className="voiceRecordBtn" 
                onClick={handleVoiceStart}
                disabled={isUploading}
              >
                🎙
              </button>
            )}
          </div>
        )}

        {/* ✅ Upload progress bar */}
        {isUploading && (
          <div className="uploadProgressContainer">
            <div className="uploadProgressLabel">Uploading... {uploadProgress}%</div>
            <div className="uploadProgressBar">
              <div 
                className="uploadProgressFill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ✅ Upload error message */}
        {uploadError && (
          <div className="uploadError">
            ⚠️ {uploadError}
            <button 
              className="closeError" 
              onClick={() => setUploadError(null)}
            >
              ✕
            </button>
          </div>
        )}

        {typingText && !isRecording && (
          <div className="typingLine">
            <span>{typingText}</span>
          </div>
        )}
      </div>

      <style>{`
        .dmCallBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, rgba(88, 101, 242, 0.1), rgba(114, 137, 218, 0.1));
          border: 1px solid rgba(88, 101, 242, 0.2);
        }
        
        .dmCallTitle { 
          font-weight: 600; 
          opacity: 0.9; 
          font-size: 14px;
        }
        
        .callBtn, .acceptBtn, .rejectBtn, .muteBtn, .endBtn {
          border: none;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
        }
        
        .callBtn {
          background: #5865f2;
          color: white;
        }
        
        .callBtn:hover {
          background: #4752c4;
        }
        
        .acceptBtn {
          background: #2ea043;
          color: white;
        }
        
        .acceptBtn:hover {
          background: #26843a;
        }
        
        .rejectBtn, .endBtn {
          background: #d73a49;
          color: white;
        }
        
        .rejectBtn:hover, .endBtn:hover {
          background: #c12838;
        }
        
        .muteBtn {
          background: rgba(255, 255, 255, 0.12);
          color: white;
        }
        
        .muteBtn:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        
        .callStatus {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 14px;
        }
        
        .callInfo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .callTimer {
          font-weight: 700;
          color: #5865f2;
          font-size: 13px;
          padding: 4px 8px;
          background: rgba(88, 101, 242, 0.15);
          border-radius: 6px;
        }

        /* ✅ Call Log Message Styling */
        .callLogMsg {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 16px 0;
          gap: 4px;
        }

        .callLogBadge {
          background: rgba(88, 101, 242, 0.12);
          color: rgba(255, 255, 255, 0.85);
          padding: 8px 16px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid rgba(88, 101, 242, 0.2);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .callLogTime {
          font-size: 11px;
          opacity: 0.5;
          margin-top: 2px;
        }

        /* ✅ File Message Styling */
        .fileMessage {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px;
        }

        .fileImageLink {
          display: block;
          border-radius: 8px;
          overflow: hidden;
          max-width: 300px;
        }

        .fileImage {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .fileLink {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(88, 101, 242, 0.1);
          border-radius: 8px;
          color: inherit;
          text-decoration: none;
          transition: all 0.2s;
          border: 1px solid rgba(88, 101, 242, 0.2);
        }

        .fileLink:hover {
          background: rgba(88, 101, 242, 0.15);
          border-color: rgba(88, 101, 242, 0.3);
        }

        .fileIcon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .fileInfo {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .fileName {
          font-weight: 500;
          font-size: 13px;
          word-break: break-word;
        }

        .fileSize {
          font-size: 11px;
          opacity: 0.6;
        }

        /* ✅ Upload Progress Bar */
        .uploadProgressContainer {
          padding: 8px 16px;
          border-top: 1px solid rgba(88, 101, 242, 0.1);
        }

        .uploadProgressLabel {
          font-size: 12px;
          opacity: 0.7;
          margin-bottom: 6px;
          text-align: center;
        }

        .uploadProgressBar {
          width: 100%;
          height: 4px;
          background: rgba(88, 101, 242, 0.1);
          border-radius: 2px;
          overflow: hidden;
        }

        .uploadProgressFill {
          height: 100%;
          background: linear-gradient(90deg, #5865f2, #7289da);
          transition: width 0.2s ease;
        }

        /* ✅ Upload Error Message */
        .uploadError {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          margin: 8px 16px 0;
          background: rgba(215, 58, 73, 0.15);
          border: 1px solid rgba(215, 58, 73, 0.3);
          border-radius: 8px;
          font-size: 12px;
          color: #ff6b6b;
        }

        .closeError {
          background: none;
          border: none;
          color: #ff6b6b;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          display: flex;
          align-items: center;
        }

        .closeError:hover {
          opacity: 0.8;
        }

        .attachBtn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          transition: transform 0.2s;
        }

        .attachBtn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .attachBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .composerInput:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sendBtn:disabled,
        .voiceRecordBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}