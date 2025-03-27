"use client"
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const VideoChatApp = () => {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketRef = useRef(null);
  const typeRef = useRef(null);
  const roomidRef = useRef(null);

  const myVideoRef = useRef(null);
  const strangerVideoRef = useRef(null);
  const buttonRef = useRef(null);
  const onlineRef = useRef(null);
  const chatWrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Square video constraints with low quality
    const LOW_QUALITY_CONSTRAINTS = {
      audio: true,
      video: {
        width: { ideal: 240 },
        height: { ideal: 240 },
        frameRate: { max: 10 },
        aspectRatio: 1, // Force square aspect ratio
        facingMode: 'user',
        resizeMode: 'crop-and-scale'
      }
    };

    // starts media capture with low-quality settings
    function start() {
      navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS)
        .then(stream => {
          if (peerRef.current) {
            // Reduce video bitrate and force square
            const videoTracks = stream.getVideoTracks();
            videoTracks.forEach(track => {
              track.applyConstraints({
                advanced: [{
                  width: 240,
                  height: 240,
                  frameRate: 10,
                  bitrate: 10000 // Reduced bitrate to 100 kbps
                }]
              });
            });

            if (myVideoRef.current) {
              myVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

            peerRef.current.ontrack = e => {
              if (strangerVideoRef.current) {
                strangerVideoRef.current.srcObject = e.streams[0];
                strangerVideoRef.current.play();
              }
            }
          }
        })
        .catch(ex => {
          console.error('Media capture error:', ex);
        });
    }

    // connect to server
    socketRef.current = io('https://server-vid-chat.onrender.com/');

    // disconnection event
    socketRef.current.on('disconnected', () => {
      window.location.href = `/?disconnect`
    })

    // Start 
    socketRef.current.emit('start', (person) => {
      typeRef.current = person;
    });

    // Get remote socket
    socketRef.current.on('remote-socket', (id) => {
      remoteSocketRef.current = id;

      // hide the spinner
      const modal = document.querySelector('.modal');
      if (modal) modal.classList.add('hidden');

      // create a peer connection with optimized configuration
      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      peerRef.current = new RTCPeerConnection(rtcConfig);

      // on negotiation needed 
      peerRef.current.onnegotiationneeded = async () => {
        webrtc();
      }

      // send ice candidates to remote socket
      peerRef.current.onicecandidate = e => {
        socketRef.current.emit('ice:send', { candidate: e.candidate, to: remoteSocketRef.current });
      }

      // start media capture
      start();
    });

    // creates offer if 'type' = p1
    async function webrtc() {
      if (typeRef.current == 'p1') {
        const offer = await peerRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        // Modify SDP to reduce video quality
        const modifiedSdp = offer.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        if (modifiedSdp) offer.sdp = modifiedSdp;

        await peerRef.current.setLocalDescription(offer);
        socketRef.current.emit('sdp:send', { sdp: peerRef.current.localDescription });
      }
    }

    // receive SDP sent by remote socket 
    socketRef.current.on('sdp:reply', async ({ sdp, from }) => {
      // set remote description 
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

      // if type == p2, create answer
      if (typeRef.current == 'p2') {
        const ans = await peerRef.current.createAnswer();
        
        // Modify SDP to reduce video quality
        const modifiedSdp = ans.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        if (modifiedSdp) ans.sdp = modifiedSdp;

        await peerRef.current.setLocalDescription(ans);
        socketRef.current.emit('sdp:send', { sdp: peerRef.current.localDescription });
      }
    });

    // receive ice-candidate from remote socket
    socketRef.current.on('ice:reply', async ({ candidate, from }) => {
      await peerRef.current.addIceCandidate(candidate);
    });

    // get room id
    socketRef.current.on('roomid', (id) => {
      roomidRef.current = id;
    })

    // Handle send button click
    const handleSendMessage = () => {
      if (inputRef.current && chatWrapperRef.current) {
        const input = inputRef.current.value;
        socketRef.current.emit('send-message', input, typeRef.current, roomidRef.current);

        // set input in local message box as 'YOU'
        const msghtml = `
        <div class="msg">
        <b>You: </b> <span id='msg'>${input}</span>
        </div>
        `
        chatWrapperRef.current.innerHTML += msghtml;

        // clear input
        inputRef.current.value = '';
      }
    }

    // Add event listener for send button
    if (buttonRef.current) {
      buttonRef.current.addEventListener('click', handleSendMessage);
    }

    // on get message
    socketRef.current.on('get-message', (input, type) => {
      if (chatWrapperRef.current) {
        // set received message from server in chat box
        const msghtml = `
        <div class="msg">
        <b>Stranger: </b> <span id='msg'>${input}</span>
        </div>
        `
        chatWrapperRef.current.innerHTML += msghtml;
      }
    })

    // Cleanup function
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      
      // Remove event listener
      if (buttonRef.current) {
        buttonRef.current.removeEventListener('click', handleSendMessage);
      }
    };
  }, []);

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

      {/* Chat Holder */}
      <div className="border-l-2 border-lightblue p-4 h-full relative flex flex-col">
        {/* Online Users */}
        <div ref={onlineRef} id="online" className="text-right mb-4">
          Online: 0
        </div>

        {/* Chat Messages */}
        <div ref={chatWrapperRef} className="wrapper flex-grow overflow-y-auto mb-4"></div>

        {/* Input Area */}
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
          >
            Send
          </button>
        </div>
      </div>

      {/* Socket.IO Client Library Script */}
      <script src="https://cdn.socket.io/4.0.0/socket.io.min.js"></script>
    </div>
  );
};

export default VideoChatApp;