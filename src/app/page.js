"use client"
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const VideoChatApp = () => {
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    // Global State
    let peer;
    const myVideo = document.getElementById('my-video');
    const strangerVideo = document.getElementById('video');
    const button = document.getElementById('send');
    const online = document.getElementById('online');
    let remoteSocket;
    let type;
    let roomid;

    // Square video constraints with low quality
    const LOW_QUALITY_CONSTRAINTS = {
      audio: true,
      video: {
        width: { ideal: 240 },
        height: { ideal: 240 },
        frameRate: { max: 15 },
        aspectRatio: 1, // Force square aspect ratio
        facingMode: 'user',
        resizeMode: 'crop-and-scale'
      }
    };

    // starts media capture with low-quality settings
    function start() {
      navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS)
        .then(stream => {
          if (peer) {
            // Reduce video bitrate and force square
            const videoTracks = stream.getVideoTracks();
            videoTracks.forEach(track => {
              track.applyConstraints({
                advanced: [{
                  width: 240,
                  height: 240,
                  frameRate: 15,
                  bitrate: 100000 // Reduced bitrate to 100 kbps
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

    // connect to server
    const socket = io('https://server-vid-chat.onrender.com/');

    // disconnection event
    socket.on('disconnected', () => {
      window.location.href = `/?disconnect`
    })

    // Start 
    socket.emit('start', (person) => {
      type = person;
    });

    // Get remote socket
    socket.on('remote-socket', (id) => {
      remoteSocket = id;

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

      peer = new RTCPeerConnection(rtcConfig);

      // on negotiation needed 
      peer.onnegotiationneeded = async () => {
        webrtc();
      }

      // send ice candidates to remote socket
      peer.onicecandidate = e => {
        socket.emit('ice:send', { candidate: e.candidate, to: remoteSocket });
      }

      // start media capture
      start();
    });

    // creates offer if 'type' = p1
    async function webrtc() {
      if (type == 'p1') {
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        // Modify SDP to reduce video quality
        const modifiedSdp = offer.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        if (modifiedSdp) offer.sdp = modifiedSdp;

        await peer.setLocalDescription(offer);
        socket.emit('sdp:send', { sdp: peer.localDescription });
      }
    }

    // receive SDP sent by remote socket 
    socket.on('sdp:reply', async ({ sdp, from }) => {
      // set remote description 
      await peer.setRemoteDescription(new RTCSessionDescription(sdp));

      // if type == p2, create answer
      if (type == 'p2') {
        const ans = await peer.createAnswer();
        
        // Modify SDP to reduce video quality
        const modifiedSdp = ans.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        if (modifiedSdp) ans.sdp = modifiedSdp;

        await peer.setLocalDescription(ans);
        socket.emit('sdp:send', { sdp: peer.localDescription });
      }
    });

    // receive ice-candidate from remote socket
    socket.on('ice:reply', async ({ candidate, from }) => {
      await peer.addIceCandidate(candidate);
    });

    // get room id
    socket.on('roomid', (id) => {
      roomid = id;
    })

    // handle send button click
    button.onclick = e => {
      // get input and emit
      const inputEl = document.querySelector('input');
      let input = inputEl.value;
      socket.emit('send-message', input, type, roomid);

      // set input in local message box as 'YOU'
      let msghtml = `
      <div class="msg">
      <b>You: </b> <span id='msg'>${input}</span>
      </div>
      `
      const wrapper = document.querySelector('.chat-holder .wrapper');
      if (wrapper) wrapper.innerHTML += msghtml;

      // clear input
      inputEl.value = '';
    }

    // on get message
    socket.on('get-message', (input, type) => {
      // set received message from server in chat box
      let msghtml = `
      <div class="msg">
      <b>Stranger: </b> <span id='msg'>${input}</span>
      </div>
      `
      const wrapper = document.querySelector('.chat-holder .wrapper');
      if (wrapper) wrapper.innerHTML += msghtml;
    })

    // Handle online users count
    socket.on('online-users', (count) => {
      setOnlineUsers(count);
    });

    // Cleanup function
    return () => {
      socket.disconnect();
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
        <div className="wrapper flex-grow overflow-y-auto mb-4"></div>

        {/* Input Area */}
        <div className="flex gap-2 mt-auto">
          <input 
            type="text" 
            placeholder='Type your message here..' 
            className="flex-grow p-2 rounded-[15px] text-sm outline outline-2 outline-violet-500"
          />
          <button 
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