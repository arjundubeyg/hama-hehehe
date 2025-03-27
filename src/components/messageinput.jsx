import { useContext, useRef } from 'react';
import { SocketContext } from '../context/socketcontext';

const MessageInput = () => {
  const { sendMessage, inputRef, buttonRef } = useContext(SocketContext);

  return (
    <div className="flex gap-2 mt-auto">
      <input 
        ref={inputRef}
        type="text" 
        placeholder='Type your message here..' 
        className="flex-grow p-2 rounded-[15px] text-sm outline outline-2 outline-violet-500"
      />
      <button 
        ref={buttonRef}
        id="send"
        className="text-sm px-4 py-2 font-bold text-white bg-blueviolet rounded-[10px] outline outline-2 outline-violet-500"
        onClick={sendMessage}
      >
        Send
      </button>
    </div>
  );
};

export default MessageInput;