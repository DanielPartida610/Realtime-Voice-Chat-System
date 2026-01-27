import { useState } from "react";
import JoinRoom from "./pages/JoinRoom";
import VoiceRoom from "./pages/VoiceRoom";

export default function App() {
  const [joined, setJoined] = useState(false);

  return joined ? (
    <VoiceRoom />
  ) : (
    <JoinRoom onJoin={() => setJoined(true)} />
  );
}