import { useContext, useRef } from 'react';
import { SocketContext } from '../context/socketcontext';
import MessageInput from './messageinput';

const ChatSection = () => {
  const { chatWrapperRef, onlineRef } = useContext(SocketContext);

  return (
    <div className="border-l-2 border-lightblue p-4 h-full relative flex flex-col">
      <div ref={onlineRef} id="online" className="text-right mb-4">
        Online: 0
      </div>

      <div ref={chatWrapperRef} className="wrapper flex-grow overflow-y-auto mb-4"></div>

      <MessageInput />
    </div>
  );
};

export default ChatSection;