import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

const EMOJIS = ["😀", "😂", "🥹", "🔥", "❤️", "👍", "🎧", "🎙️", "✨", "😤"];
const REACTS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

export default function ChatBox({
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
}) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const endRef = useRef(null);

  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

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

  // Handle voice recording
  const handleVoiceStart = () => {
    startRecording();
  };

  const handleVoiceSend = async () => {
    console.log("🎤 Stopping recording...");
    const blob = await stopRecording();
    
    if (!blob) {
      console.error("❌ No blob returned from recording");
      return;
    }
    
    console.log("✅ Got blob:", blob.size, "bytes, type:", blob.type);
    
    if (onSendVoice) {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        console.log("📤 Sending voice message, base64 length:", base64?.length);
        
        onSendVoice({
          audio: base64,
          duration: recordingTime,
          mimeType: blob.type,
        });
        
        console.log("✅ Voice message sent!");
      };
      
      reader.onerror = () => {
        console.error("❌ Failed to read blob");
      };
      
      reader.readAsDataURL(blob);
    } else {
      console.error("❌ onSendVoice callback not provided");
    }
  };

  const handleVoiceCancel = () => {
    cancelRecording();
  };

  // ✅ NEW: Play voice with AMPLIFICATION using Web Audio API
  const playVoiceMessage = async (mimeType, base64Audio) => {
    console.log("▶️ Playing voice message with amplification");
    
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Convert base64 to array buffer
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }
      
      console.log("🔊 Decoding audio...");
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log("✅ Audio decoded, duration:", audioBuffer.duration);
      
      // Create source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // ✅ CREATE GAIN NODE (VOLUME BOOSTER)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 3.0; // ✅ 3x LOUDER! (Adjust this: 2.0-5.0)
      
      // Connect: source → gain → speakers
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play
      source.start(0);
      console.log("✅ Audio playing at 3x volume");
      
      // Cleanup when done
      source.onended = () => {
        console.log("⏹️ Audio finished");
        audioContext.close();
      };
      
    } catch (err) {
      console.error("❌ Failed to play audio:", err);
      alert("Failed to play audio: " + err.message);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Normalize name for comparison
  const normalizeName = (name) => (name || "").trim().toLowerCase();

  const placeholder = isDM ? `Message @${dmUser || "dm"}` : "Message #general";

  return (
    <>
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

          // Proper "me" detection with normalized comparison
          const isMe = myName && m.user && normalizeName(m.user) === normalizeName(myName);

          const initials = (m.user || "?").slice(0, 2).toUpperCase();
          const msgReacts = reactions?.[m.id] || {};
          const hasReactions = Object.keys(msgReacts).length > 0;

          return (
            <div key={m.id} className={`chatRow ${isMe ? "me" : "other"}`}>
              {/* Avatar on LEFT for others only */}
              {!isMe && (
                <div className="chatAvatar" title={m.user}>
                  {initials}
                </div>
              )}

              <div className="chatContent">
                {/* Show name for others only */}
                {!isMe && (
                  <div className="chatMeta">
                    <span className="chatName">{m.user}</span>
                    {m.time && <span className="msgTime">{m.time}</span>}
                  </div>
                )}

                <div className={`chatBubble ${isMe ? "myBubble" : "otherBubble"}`}>
                  {/* Voice message */}
                  {m.type === "voice" ? (
                    <div className="voiceMessage">
                      <button 
                        className="voicePlayBtn"
                        onClick={() => playVoiceMessage(m.mimeType, m.audio)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                      <div className="voiceWaveform">
                        <div className="voiceDuration">{formatTime(m.duration || 0)}</div>
                        <div className="waveformBars">
                          {[...Array(20)].map((_, i) => (
                            <div key={i} className="waveBar" style={{height: `${Math.random() * 100}%`}} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Text message */
                    <div className="chatText">{m.text}</div>
                  )}
                  
                  {/* Show time for my messages inside bubble */}
                  {isMe && m.time && (
                    <div className="msgTime myTime">{m.time}</div>
                  )}
                </div>

                {/* Reactions */}
                {hasReactions && (
                  <div className="reactionsDisplay">
                    {Object.entries(msgReacts).map(([emoji, users]) => (
                      users.length > 0 && (
                        <button
                          key={emoji}
                          className={`reactionBubble ${users.some(u => normalizeName(u) === normalizeName(myName)) ? "myReaction" : ""}`}
                          onClick={() => onReact?.(m.id, emoji)}
                          title={users.join(", ")}
                        >
                          <span className="reactionEmoji">{emoji}</span>
                          <span className="reactionCount">{users.length}</span>
                        </button>
                      )
                    ))}
                  </div>
                )}

                {/* Add reaction button */}
                {onReact && (
                  <div className="addReaction">
                    {REACTS.map((emoji) => (
                      <button
                        key={emoji}
                        className="quickReact"
                        onClick={() => onReact(m.id, emoji)}
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Avatar on RIGHT for me only */}
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
        {/* Emoji quick picks */}
        {!isRecording && (
          <div className="emojiBar">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="emojiBtn"
                onClick={() => setText((t) => t + e)}
                title={`Add ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Recording UI */}
        {isRecording && (
          <div className="recordingBar">
            <button className="cancelRecordBtn" onClick={handleVoiceCancel} title="Cancel Recording">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>

            <div className="recordingInfo">
              <div className="recordingIndicator">
                <div className="recordingDot" />
                <span className="recordingTime">{formatTime(recordingTime)}</span>
              </div>
              <div className="recordingWave">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="recordBar" />
                ))}
              </div>
            </div>

            <button className="sendRecordBtn" onClick={handleVoiceSend} title="Send Voice Message">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        )}

        {/* Normal composer */}
        {!isRecording && (
          <div className="composerBox">
            <button 
              className="attachBtn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
              </svg>
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

            {/* Voice record button or send button */}
            {text.trim() ? (
              <button className="sendBtn" onClick={send}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            ) : (
              <button 
                className="voiceRecordBtn" 
                onClick={handleVoiceStart}
                title="Record voice message"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {typingText && !isRecording && (
          <div className="typingLine">
            <div className="typingDots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>{typingText}</span>
          </div>
        )}
      </div>

      {/* Voice message styles */}
      <style>{`
        .voiceMessage {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
        }

        .voicePlayBtn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .voicePlayBtn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .voiceWaveform {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .voiceDuration {
          font-size: 12px;
          opacity: 0.8;
        }

        .waveformBars {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 24px;
        }

        .waveBar {
          width: 3px;
          background: currentColor;
          opacity: 0.6;
          border-radius: 2px;
          transition: height 0.2s ease;
        }

        /* Recording UI */
        .recordingBar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--bg-modifier);
          border-radius: 8px;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .recordingInfo {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .recordingIndicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .recordingDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--danger);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }

        .recordingTime {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          min-width: 50px;
        }

        .recordingWave {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 32px;
          overflow: hidden;
        }

        .recordBar {
          width: 3px;
          background: var(--brand);
          border-radius: 2px;
          animation: waveAnim 1s ease-in-out infinite;
        }

        .recordBar:nth-child(odd) {
          animation-delay: 0.1s;
        }

        .recordBar:nth-child(3n) {
          animation-delay: 0.2s;
        }

        @keyframes waveAnim {
          0%, 100% {
            height: 8px;
            opacity: 0.5;
          }
          50% {
            height: 24px;
            opacity: 1;
          }
        }

        .cancelRecordBtn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(237, 66, 69, 0.1);
          color: var(--danger);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .cancelRecordBtn:hover {
          background: var(--danger);
          color: white;
          transform: scale(1.05);
        }

        .cancelRecordBtn:active {
          transform: scale(0.95);
        }

        .sendRecordBtn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: var(--brand);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .sendRecordBtn:hover {
          background: var(--brand-hover);
          transform: scale(1.05);
        }

        .sendRecordBtn:active {
          transform: scale(0.95);
        }

        .voiceRecordBtn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--brand);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .voiceRecordBtn:hover {
          background: var(--brand-hover);
          transform: scale(1.05);
        }
      `}</style>
    </>
  );
}