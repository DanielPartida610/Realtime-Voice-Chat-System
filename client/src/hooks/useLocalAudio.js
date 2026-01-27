import { useEffect, useState } from "react";

export function useLocalAudio() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (mounted) setStream(s);
      } catch (e) {
        setError(e?.message || "Mic permission denied");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { stream, error };
}