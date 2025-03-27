import { useContext, useRef } from 'react';
import { SocketContext } from '../context/socketcontext';

const VideoSection = () => {
  const { myVideoRef, strangerVideoRef } = useContext(SocketContext);

  return (
    <div className="md:col-span-2 relative p-4 flex flex-col items-center">
      <div className="w-full max-w-[600px] aspect-square">
        <video 
          ref={strangerVideoRef}
          autoPlay 
          id="video" 
          className="bg-black rounded-[20px] w-full h-full object-cover"
        ></video>
      </div>
      <div className="absolute bottom-5 right-5 w-[150px] h-[150px] md:w-[200px] md:h-[200px]">
        <video 
          ref={myVideoRef}
          autoPlay 
          id="my-video" 
          className="rounded-full object-cover border-2 border-violet-500 w-full h-full"
        ></video>
      </div>
    </div>
  );
};

export default VideoSection;