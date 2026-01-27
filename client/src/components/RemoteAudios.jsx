import { useEffect, useRef } from "react";

export default function RemoteAudios({ remoteStreams }) {
  return (
    <div>
      {remoteStreams.map(({ id, stream }) => (
        <Audio key={id} stream={stream} />
      ))}
    </div>
  );
}

function Audio({ stream }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline />;
}