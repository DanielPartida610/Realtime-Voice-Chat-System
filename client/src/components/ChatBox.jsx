import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

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
  call, // ✅ Receive call from parent
}) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const endRef = useRef(null);

  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } =
    useVoiceRecorder();

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

  const normalizeName = (name) => (name || "").trim().toLowerCase();
  const placeholder = isDM ? `Message @${dmUser || "dm"}` : "Message #general";

  return (
    <>
      {/* ✅ DM CALL BAR with duration */}
      {isDM && dmUser && call && (
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
            <button className="attachBtn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              🙂
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
            />

            {text.trim() ? (
              <button className="sendBtn" onClick={send}>
                ➤
              </button>
            ) : (
              <button className="voiceRecordBtn" onClick={handleVoiceStart}>
                🎙
              </button>
            )}
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
      `}</style>
    </>
  );
}