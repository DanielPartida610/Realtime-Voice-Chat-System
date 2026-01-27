import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useWebRTC(socket, localStream, users) {
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState([]); // {id, stream}

  const addRemoteStream = (id, stream) => {
    setRemoteStreams((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) return prev.map((x) => (x.id === id ? { id, stream } : x));
      return [...prev, { id, stream }];
    });
  };

  const removePeer = (id) => {
    const pc = peersRef.current.get(id);
    if (pc) pc.close();
    peersRef.current.delete(id);
    setRemoteStreams((prev) => prev.filter((x) => x.id !== id));
  };

  const createPeer = async (remoteId, isInitiator) => {
    if (!localStream) return;
    if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // push our mic tracks
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    // receive remote tracks
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      addRemoteStream(remoteId, stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice", { to: remoteId, candidate: event.candidate });
      }
    };

    peersRef.current.set(remoteId, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("webrtc:offer", { to: remoteId, offer });
    }

    return pc;
  };

  // When users list updates, ensure peers exist (mesh)
  useEffect(() => {
    if (!localStream) return;
    const others = users.map((u) => u.socketId).filter((id) => id !== socket.id);

    // create peers for everyone (initiator based on id ordering to avoid double offers)
    others.forEach((remoteId) => {
      const isInitiator = socket.id < remoteId;
      createPeer(remoteId, isInitiator);
    });

    // cleanup peers that left
    for (const id of peersRef.current.keys()) {
      if (!others.includes(id)) removePeer(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, localStream]);

  // socket signaling handlers
  useEffect(() => {
    if (!localStream) return;

    const onOffer = async ({ from, offer }) => {
      const pc = await createPeer(from, false);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { to: from, answer });
    };

    const onAnswer = async ({ from, answer }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(answer);
    };

    const onIce = async ({ from, candidate }) => {
      const pc = peersRef.current.get(from);
      if (!pc) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    };

    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice", onIce);

    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  return { remoteStreams };
}