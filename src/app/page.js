"use client"
import { useEffect } from 'react';
import { io } from 'socket.io-client';

const VideoChatApp = () => {
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

    // Low-quality video constraints
    const LOW_QUALITY_CONSTRAINTS = {
      audio: true,
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { max: 15 },
        aspectRatio: 1.33,
        facingMode: 'user',
        resizeMode: 'crop-and-scale'
      }
    };

    // starts media capture with low-quality settings
    function start() {
      navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS)
        .then(stream => {
          if (peer) {
            // Reduce video bitrate
            const videoTracks = stream.getVideoTracks();
            videoTracks.forEach(track => {
              track.applyConstraints({
                advanced: [{
                  width: 320,
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
      document.querySelector('.modal').style.display = 'none';

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
      peer.onnegotiationneeded = async e => {
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
        const modifiedSdp = offer.sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        offer.sdp = modifiedSdp;

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
        const modifiedSdp = ans.sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
        ans.sdp = modifiedSdp;

        await peer.setLocalDescription(ans);
        socket.emit('sdp:send', { sdp: peer.localDescription });
      }
    });

    // receive ice-candidate from remote socket
    socket.on('ice:reply', async ({ candidate, from }) => {
      await peer.addIceCandidate(candidate);
    });

    // get room id
    socket.on('roomid', id => {
      roomid = id;
    })

    // handle send button click
    button.onclick = e => {
      // get input and emit
      let input = document.querySelector('input').value;
      socket.emit('send-message', input, type, roomid);

      // set input in local message box as 'YOU'
      let msghtml = `
      <div class="msg">
      <b>You: </b> <span id='msg'>${input}</span>
      </div>
      `
      document.querySelector('.chat-holder .wrapper')
      .innerHTML += msghtml;

      // clear input
      document.querySelector('input').value = '';
    }

    // on get message
    socket.on('get-message', (input, type) => {
      // set received message from server in chat box
      let msghtml = `
      <div class="msg">
      <b>Stranger: </b> <span id='msg'>${input}</span>
      </div>
      `
      document.querySelector('.chat-holder .wrapper')
      .innerHTML += msghtml;
    })

    // Optional: Handle potential connection errors
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      document.querySelector('.modal').innerHTML = 'Connection failed. Please try again.';
    });

    // Optional: Handle online users count
    socket.on('online-users', (count) => {
      if (online) {
        online.textContent = `Online: ${count}`;
      }
    });

    // Cleanup function
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-8 h-screen overflow-hidden">
      {/* Spinner */}
      <div className="modal fixed inset-0 bg-black/45 z-100 flex justify-center items-center">
        <span 
          id="spinner" 
          className="text-white font-bold h-[200px] w-[200px] flex items-center justify-center rounded-full animate-pulse"
        >
          Waiting For Someone...
        </span>
      </div>

      {/* Video Holder */}
      <div className="video-holder col-span-2 relative p-[60px]">
        <video 
          autoPlay 
          id="video" 
          className="bg-black rounded-[20px] w-full h-[calc(100vh-120px)] object-cover"
        ></video>
        <video 
          autoPlay 
          id="my-video" 
          className="absolute bottom-5 right-5 w-[300px] h-[300px] rounded-full object-cover border-2 border-violet-500"
        ></video>
      </div>

      {/* Chat Holder */}
      <div className="chat-holder border-l-2 border-lightblue p-[30px] h-[calc(100vh-60px)] relative overflow-auto">
        <div className="wrapper mb-[35px]"></div>
        <div className="input fixed bottom-0 flex gap-5 min-w-[400px] bg-white py-[30px]">
          <input 
            type="text" 
            placeholder='Type your message here..' 
            className="w-full p-[10px] rounded-[15px] text-[13px] outline outline-2 outline-violet-500"
          />
          <button 
            id="send"
            className="text-[14px] px-5 py-[10px] font-bold text-white bg-blueviolet rounded-[10px] outline outline-2 outline-violet-500"
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