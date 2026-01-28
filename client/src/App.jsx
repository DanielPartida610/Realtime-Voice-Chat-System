import { useState } from "react";
import JoinRoom from "./pages/JoinRoom";
import RoomSelector from "./pages/RoomSelector";
import VoiceRoom from "./pages/VoiceRoom";

export default function App() {
  const [step, setStep] = useState("join"); // "join" | "selectRoom" | "inRoom"
  const [selectedRoom, setSelectedRoom] = useState(null);

  const handleJoin = () => {
    setStep("selectRoom");
  };

  const handleRoomSelect = (roomId, roomName) => {
    setSelectedRoom({ id: roomId, name: roomName });
    setStep("inRoom");
  };

  const handleLeave = () => {
    setSelectedRoom(null);
    setStep("selectRoom");
  };

  return (
    <>
      {step === "join" && <JoinRoom onJoin={handleJoin} />}
      {step === "selectRoom" && <RoomSelector onRoomSelect={handleRoomSelect} />}
      {step === "inRoom" && <VoiceRoom roomId={selectedRoom?.id} roomName={selectedRoom?.name} onLeave={handleLeave} />}
    </>
  );
}