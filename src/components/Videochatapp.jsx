"use client"
import { SocketProvider } from '../context/socketcontext';
import VideoSection from './Videosection';
import ChatSection from './Chatsection';
import WaitingModal from './Waitingmodal';

const VideoChatApp = () => {
  return (
    <SocketProvider>
      <div className="flex flex-col md:grid md:grid-cols-3 gap-4 h-screen overflow-hidden">
        <WaitingModal />
        <VideoSection />
        <ChatSection />
      </div>
    </SocketProvider>
  );
};

export default VideoChatApp;