import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😀", "😂", "🥹", "🔥", "❤️", "👍", "🎧", "🎙️", "✨", "😤"];
const REACTS = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

export default function ChatBox({
  messages,
  onSend,
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

  // FIXED: Normalize name for comparison
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

          // FIXED: Proper "me" detection with normalized comparison
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
                  <div className="chatText">{m.text}</div>
                  
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

          <button className="sendBtn" onClick={send} disabled={!text.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>

        {typingText && (
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
    </>
  );
}