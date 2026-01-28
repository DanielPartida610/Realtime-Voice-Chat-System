import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      console.log("🎤 Requesting microphone access...");
      
      // ✅ BEST QUALITY SETTINGS
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,  // ✅ Automatic volume boost
          sampleRate: 48000,      // ✅ Higher quality (48kHz)
          channelCount: 1,        // Mono (smaller file size)
        }
      });
      
      streamRef.current = stream;
      console.log("✅ Microphone access granted");
      
      // ✅ Try best quality MIME types first
      let mimeType;
      let bitrate = 256000; // 256kbps for high quality
      
      const types = [
        { type: 'audio/webm;codecs=opus', bitrate: 256000 },  // Best quality
        { type: 'audio/webm', bitrate: 192000 },
        { type: 'audio/ogg;codecs=opus', bitrate: 192000 },
        { type: 'audio/mp4', bitrate: 128000 },
      ];
      
      for (const config of types) {
        if (MediaRecorder.isTypeSupported(config.type)) {
          mimeType = config.type;
          bitrate = config.bitrate;
          console.log("✅ Using MIME type:", config.type, "at", bitrate, "bps");
          break;
        }
      }
      
      if (!mimeType) {
        console.warn("⚠️ No preferred MIME type supported, using default");
        mimeType = '';
        bitrate = 128000;
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: bitrate,  // ✅ High quality bitrate
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log("📦 Audio chunk:", e.data.size, "bytes");
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("⏹️ MediaRecorder stopped");
      };
      
      mediaRecorderRef.current = mediaRecorder;
      
      // ✅ Smaller chunks for better quality
      mediaRecorder.start(50); // Capture every 50ms
      setIsRecording(true);
      console.log("🔴 Recording started");
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("❌ Failed to start recording:", err);
      alert("Microphone access denied. Please allow microphone permission and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      console.log("⏸️ Stopping recording...");
      
      if (!mediaRecorderRef.current || !streamRef.current) {
        console.error("❌ No media recorder or stream found");
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        console.log("✅ Creating blob from", chunksRef.current.length, "chunks");
        
        const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        console.log("✅ Blob created:", blob.size, "bytes, type:", blob.type);
        
        // Stop all tracks
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("⏹️ Track stopped");
        });
        
        streamRef.current = null;
        chunksRef.current = [];
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    });
  }, []);

  const cancelRecording = useCallback(() => {
    console.log("❌ Cancelling recording");
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    chunksRef.current = [];
    setIsRecording(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingTime(0);
  }, [isRecording]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}