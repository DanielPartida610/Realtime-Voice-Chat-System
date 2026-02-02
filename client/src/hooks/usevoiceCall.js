// hooks/useVoiceCall.jsx
import { useEffect, useRef, useState } from "react";

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useVoiceCall({ socket, myName, onCallLog }) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // remote audio + amplification
  const remoteAudioRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const remoteGainRef = useRef(null);
  const remoteCompressorRef = useRef(null);
  const remoteSourceRef = useRef(null);

  const callTimeoutRef = useRef(null);
  const callTimerRef = useRef(null);

  const [state, setState] = useState("idle"); // idle | calling | ringing | in-call
  const [peer, setPeer] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // refs (avoid stale closures)
  const stateRef = useRef("idle");
  const peerRef = useRef("");
  const callDurationRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  // format duration MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // call timer
  const startCallTimer = () => {
    stopCallTimer();
    setCallDuration(0);
    callDurationRef.current = 0;

    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallDuration(callDurationRef.current);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // ✅ Remote audio with amplification
  const ensureRemoteAudio = () => {
    // create <audio> element once
    if (!remoteAudioRef.current) {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.volume = 1.0;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
      console.log("🔊 Remote audio element created");
    }

    // create AudioContext + compressor + gain once
    if (!remoteAudioCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // smoother sound
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const gain = ctx.createGain();
      gain.gain.value = 1.6; // 🔊 amplification (1.0 = normal). Try 1.2–2.2

      // chain: source -> compressor -> gain -> speakers
      compressor.connect(gain);
      gain.connect(ctx.destination);

      remoteAudioCtxRef.current = ctx;
      remoteCompressorRef.current = compressor;
      remoteGainRef.current = gain;

      console.log("🎚️ Remote amplification enabled:", gain.gain.value, "x");
    }
  };

  const getMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
          latency: 0,
        },
      });
      console.log("🎙️ Microphone access granted");
      return stream;
    } catch (err) {
      console.error("❌ Microphone access denied:", err);
      alert("Microphone access is required for voice calls");
      throw err;
    }
  };

  const cleanup = () => {
    console.log("🧹 Cleaning up call resources");

    // timeouts
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // timer
    stopCallTimer();
    setCallDuration(0);
    callDurationRef.current = 0;

    // stop mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // close pc
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    // disconnect remote source (avoid duplicate audio)
    if (remoteSourceRef.current) {
      try {
        remoteSourceRef.current.disconnect();
      } catch {}
      remoteSourceRef.current = null;
    }

    // reset <audio>
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    // close audio context
    if (remoteAudioCtxRef.current) {
      try {
        remoteAudioCtxRef.current.close();
      } catch {}
      remoteAudioCtxRef.current = null;
      remoteGainRef.current = null;
      remoteCompressorRef.current = null;
    }

    setIsMuted(false);
    setPeer("");
    peerRef.current = "";

    setState("idle");
    stateRef.current = "idle";
  };

  const createPC = (otherUser) => {
    console.log("🔗 Creating peer connection with:", otherUser);
    ensureRemoteAudio();

    const pc = new RTCPeerConnection(rtcConfig);

    pc.ontrack = (event) => {
      console.log("📥 Remote track received");
      const remoteStream = event.streams[0];

      const audio = remoteAudioRef.current;
      if (audio) audio.srcObject = remoteStream;

      const ctx = remoteAudioCtxRef.current;
      const compressor = remoteCompressorRef.current;

      if (ctx && compressor) {
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        // ✅ prevent double audio
        if (remoteSourceRef.current) {
          try {
            remoteSourceRef.current.disconnect();
          } catch {}
        }

        const source = ctx.createMediaStreamSource(remoteStream);
        remoteSourceRef.current = source;

        source.connect(compressor);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("webrtc:ice", { to: otherUser, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🔌 ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("🔌 Connection state:", pc.connectionState);

      if (pc.connectionState === "connected" && !callTimerRef.current) {
        console.log("✅ WebRTC connected, starting timer");
        startCallTimer();
      }

      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.log("⚠️ Connection lost, cleaning up");
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // ----------------------------
  // CALL FLOW
  // ----------------------------

  const startCall = (toUser) => {
    console.log("📞 startCall:", { socket: !!socket, toUser });

    if (!socket) {
      alert("Socket not connected. Please refresh.");
      return;
    }
    if (!toUser) return;

    setPeer(toUser);
    peerRef.current = toUser;

    setState("calling");
    stateRef.current = "calling";

    socket.emit("call:request", { to: toUser });

    callTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Outgoing call timeout (no answer)");

      onCallLog?.({
        type: "missed",
        peer: toUser,
        timestamp: new Date().toISOString(),
        direction: "outgoing",
      });

      socket.emit("call:timeout", { to: toUser });
      cleanup();
      alert(`${toUser} didn't answer`);
    }, 30000);
  };

  const acceptCall = async () => {
    const p = peerRef.current;
    console.log("✅ Accepting call from:", p);

    if (!socket || !p) return;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    try {
      setState("in-call");
      stateRef.current = "in-call";

      // helps autoplay policies in some browsers
      ensureRemoteAudio();
      const ctx = remoteAudioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      socket.emit("call:accept", { to: p });

      const stream = await getMic();
      localStreamRef.current = stream;

      const pc = createPC(p);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      onCallLog?.({
        type: "answered",
        peer: p,
        timestamp: new Date().toISOString(),
        direction: "incoming",
      });

      console.log("✅ Call accepted");
    } catch (err) {
      console.error("❌ Error accepting call:", err);
      cleanup();
    }
  };

  const rejectCall = () => {
    const p = peerRef.current;
    console.log("❌ Rejecting call from:", p);

    if (!socket || !p) return;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    socket.emit("call:reject", { to: p });

    onCallLog?.({
      type: "rejected",
      peer: p,
      timestamp: new Date().toISOString(),
      direction: "incoming",
    });

    cleanup();
  };

  const createOffer = async (toUser) => {
    if (!socket || !toUser) return;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    try {
      const stream = await getMic();
      localStreamRef.current = stream;

      const pc = createPC(toUser);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("webrtc:offer", { to: toUser, offer });

      setState("in-call");
      stateRef.current = "in-call";

      onCallLog?.({
        type: "answered",
        peer: toUser,
        timestamp: new Date().toISOString(),
        direction: "outgoing",
      });
    } catch (err) {
      console.error("❌ Error creating offer:", err);
      cleanup();
    }
  };

  const endCall = () => {
    const p = peerRef.current;
    const duration = callDurationRef.current;

    console.log("📴 Ending call with:", p, "Duration:", duration);

    if (socket && p) {
      socket.emit("call:end", { to: p, duration });
    }

    if (stateRef.current === "in-call" && duration > 0) {
      onCallLog?.({
        type: "ended",
        peer: p,
        duration,
        timestamp: new Date().toISOString(),
      });
    }

    cleanup();
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setIsMuted(next);
    console.log(next ? "🔇 Muted" : "🔊 Unmuted");
  };

  // ----------------------------
  // SOCKET LISTENERS (REGISTER ONCE)
  // ----------------------------
  useEffect(() => {
    if (!socket || !myName) return;

    console.log("📡 Registering call event listeners");
    socket.emit("user:online", { name: myName });

    const onIncoming = ({ from }) => {
      console.log("📞 Incoming call from:", from);

      setPeer(from);
      peerRef.current = from;

      setState("ringing");
      stateRef.current = "ringing";

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Incoming call timeout");

        onCallLog?.({
          type: "missed",
          peer: from,
          timestamp: new Date().toISOString(),
          direction: "incoming",
        });

        socket.emit("call:reject", { to: from });
        cleanup();
      }, 30000);
    };

    const onAccepted = async ({ from }) => {
      console.log("✅ Call accepted by:", from);
      await createOffer(from);
    };

    const onRejected = ({ from }) => {
      console.log("❌ Call rejected by:", from);

      onCallLog?.({
        type: "rejected",
        peer: from,
        timestamp: new Date().toISOString(),
        direction: "outgoing",
      });

      cleanup();
      alert(`${from} rejected your call`);
    };

    const onEnded = ({ from, duration }) => {
      console.log("📴 Call ended by:", from, "Duration:", duration);

      const finalDuration = duration ?? callDurationRef.current;

      if (finalDuration > 0) {
        onCallLog?.({
          type: "ended",
          peer: from,
          duration: finalDuration,
          timestamp: new Date().toISOString(),
        });
      }

      cleanup();
    };

    const onTimeout = ({ from }) => {
      console.log("⏰ Call timeout from:", from);

      onCallLog?.({
        type: "missed",
        peer: from,
        timestamp: new Date().toISOString(),
        direction: "incoming",
      });

      cleanup();
    };

    const onUnavailable = ({ to }) => {
      console.log("❌ User unavailable:", to);
      alert(`${to} is not available`);
      cleanup();
    };

    const onOffer = async ({ from, offer }) => {
      console.log("📥 Offer received from:", from);

      try {
        if (stateRef.current !== "in-call") {
          setPeer(from);
          peerRef.current = from;
          setState("in-call");
          stateRef.current = "in-call";
        }

        const pc = pcRef.current || createPC(from);

        if (!localStreamRef.current) {
          const stream = await getMic();
          localStreamRef.current = stream;
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        }

        await pc.setRemoteDescription(offer);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc:answer", { to: from, answer });
      } catch (err) {
        console.error("❌ Error handling offer:", err);
        cleanup();
      }
    };

    const onAnswer = async ({ from, answer }) => {
      console.log("📥 Answer received from:", from);

      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(answer);
        console.log("✅ Remote description set");
      } catch (err) {
        console.error("❌ Error setting remote description:", err);
      }
    };

    const onIce = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.error("❌ ICE error:", e);
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:timeout", onTimeout);
    socket.on("call:unavailable", onUnavailable);

    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice", onIce);

    return () => {
      console.log("🧹 Cleaning up call listeners");

      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:timeout", onTimeout);
      socket.off("call:unavailable", onUnavailable);

      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
    };
  }, [socket, myName, onCallLog]);

  // cleanup on unmount
  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    peer,
    isMuted,
    callDuration: formatDuration(callDuration),
    startCall,
    acceptCall,
    rejectCall,
    toggleMute,
    endCall,
  };
}
