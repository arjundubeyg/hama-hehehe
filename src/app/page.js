"use client"
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const VideoChatApp = () => {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // connect to server
    const socket = io('https://server-vid-chat.onrender.com/');
    socketRef.current = socket;

    let peer;
    let type;
    let roomid;

    // Square video constraints with low quality
    const LOW_QUALITY_CONSTRAINTS = {
      audio: true,
      video: {
        width: { ideal: 240 },
        height: { ideal: 240 },
        frameRate: { max: 15 },
        aspectRatio: 1,
        facingMode: 'user',
        resizeMode: 'crop-and-scale'
      }
    };

    // Media capture function
    function start() {
      const myVideo = document.getElementById('my-video');
      const strangerVideo = document.getElementById('video');

      navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS)
        .then(stream => {
          if (peer) {
            const videoTracks = stream.getVideoTracks();
            videoTracks.forEach(track => {
              track.applyConstraints({
                advanced: [{
                  width: 240,
                  height: 240,
                  frameRate: 15,
                  bitrate: 100000
                }]
              });
            });

            myVideo.srcObject = stream;
            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            peer.ontrack = e => {
              strangerVideo.srcObject = e.streams[0];
              strangerVideo.play();
            }
          }
        })
        .catch(ex => {
          console.error('Media capture error:', ex);
        });
    }

    // Socket event listeners
    socket.on('disconnected', () => {
      window.location.href = `/?disconnect`
    });

    socket.emit('start', (person) => {
      type = person;
    });

    socket.on('remote-socket', (id) => {
      const remoteSocket = id;
      document.querySelector('.modal')?.classList.add('hidden');

      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      peer = new RTCPeerConnection(rtcConfig);

      peer.onnegotiationneeded = async () => {
        if (type == 'p1') {
          const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          const modifiedSdp = offer.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
          if (modifiedSdp) offer.sdp = modifiedSdp;

          await peer.setLocalDescription(offer);
          socket.emit('sdp:send', { sdp: peer.localDescription });
        }
      };

      peer.onicecandidate = e => {
        socket.emit('ice:send', { candidate: e.candidate, to: remoteSocket });
      };

      start();
    });

    // Messaging events
    socket.on('get-message', (input, msgType) => {
      setMessages(prevMessages => [
        ...prevMessages, 
        { text: input, sender: 'Stranger' }
      ]);
    });

    socket.on('online-users', (count) => {
      setOnlineUsers(count);
    });

    socket.on('roomid', (id) => {
      roomid = id;
    });

    // Cleanup function
    return () => {
      socket.disconnect();
    };
  }, []);

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Emit message to server
    socketRef.current?.emit('send-message', inputMessage, 'type', 'roomid');

    // Add message to local state
    setMessages(prevMessages => [
      ...prevMessages, 
      { text: inputMessage, sender: 'You' }
    ]);

    // Clear input
    setInputMessage('');
  };

  return (
    <div className="flex flex-col md:grid md:grid-cols-3 gap-4 h-screen overflow-hidden">
      {/* Spinner */}
      <div className="modal fixed inset-0 bg-black/45 z-50 flex justify-center items-center">
        <span 
          id="spinner" 
          className="text-white font-bold h-[200px] w-[200px] flex items-center justify-center rounded-full animate-pulse"
        >
          Waiting For Someone...
        </span>
      </div>

      {/* Video Holder */}
      <div className="md:col-span-2 relative p-4 flex flex-col items-center">
        <div className="w-full max-w-[600px] aspect-square">
          <video 
            autoPlay 
            id="video" 
            className="bg-black rounded-[20px] w-full h-full object-cover"
          ></video>
        </div>
        <div className="absolute bottom-5 right-5 w-[150px] h-[150px] md:w-[200px] md:h-[200px]">
          <video 
            autoPlay 
            id="my-video" 
            className="rounded-full object-cover border-2 border-violet-500 w-full h-full"
          ></video>
        </div>
      </div>

      {/* Chat Holder */}
      <div className="border-l-2 border-lightblue p-4 h-full relative flex flex-col">
        {/* Online Users */}
        <div id="online" className="text-right mb-4">
          Online: {onlineUsers}
        </div>

        {/* Chat Messages */}
        <div className="wrapper flex-grow overflow-y-auto mb-4 space-y-2">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`msg ${msg.sender === 'You' ? 'text-right' : 'text-left'}`}
            >
              <b>{msg.sender}: </b> 
              <span>{msg.text}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto">
          <input 
            type="text" 
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder='Type your message here..' 
            className="flex-grow p-2 rounded-[15px] text-sm outline outline-2 outline-violet-500"
          />
          <button 
            type="submit"
            className="text-sm px-4 py-2 font-bold text-white bg-blueviolet rounded-[10px] outline outline-2 outline-violet-500"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default VideoChatApp;