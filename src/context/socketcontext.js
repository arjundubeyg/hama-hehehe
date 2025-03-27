import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const SocketContext = createContext({
  socket: null,
  peer: null,
  remoteSocketId: null,
  type: null,
  roomId: null,
  myVideoRef: { current: null },
  strangerVideoRef: { current: null },
  chatWrapperRef: { current: null },
  onlineRef: { current: null },
  sendMessage: () => {},
  messages: []
});

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketRef = useRef(null);
  const typeRef = useRef(null);
  const roomidRef = useRef(null);

  const myVideoRef = useRef(null);
  const strangerVideoRef = useRef(null);
  const chatWrapperRef = useRef(null);
  const onlineRef = useRef(null);

  const [messages, setMessages] = useState([]);

  const LOW_QUALITY_CONSTRAINTS = {
    audio: true,
    video: {
      width: { ideal: 240 },
      height: { ideal: 240 },
      frameRate: { max: 10 },
      aspectRatio: 1,
      facingMode: 'user',
      resizeMode: 'crop-and-scale'
    }
  };

  const getRTCConfig = () => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  });

  const start = useCallback(() => {
    navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS)
      .then(stream => {
        if (peerRef.current && myVideoRef.current) {
          const videoTracks = stream.getVideoTracks();
          videoTracks.forEach(track => {
            track.applyConstraints({
              advanced: [{
                width: 240,
                height: 240,
                frameRate: 10,
                bitrate: 10000
              }]
            });
          });

          myVideoRef.current.srcObject = stream;
          stream.getTracks().forEach(track => peerRef.current?.addTrack(track, stream));

          peerRef.current.ontrack = e => {
            if (strangerVideoRef.current) {
              strangerVideoRef.current.srcObject = e.streams[0];
              strangerVideoRef.current.play();
            }
          };
        }
      })
      .catch(ex => {
        console.error('Media capture error:', ex);
      });
  }, []);

  const sendMessage = useCallback((message) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit('send-message', message, typeRef.current, roomidRef.current);
      setMessages(prev => [...prev, { sender: 'You', text: message }]);
    }
  }, []);

  const webrtc = useCallback(async () => {
    if (typeRef.current === 'p1' && peerRef.current && socketRef.current) {
      const offer = await peerRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      const modifiedSdp = offer.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
      if (modifiedSdp) offer.sdp = modifiedSdp;

      await peerRef.current.setLocalDescription(offer);
      socketRef.current.emit('sdp:send', { sdp: peerRef.current.localDescription });
    }
  }, []);

  useEffect(() => {
    socketRef.current = io('https://server-vid-chat.onrender.com/');

    socketRef.current.on('disconnected', () => {
      window.location.href = `/?disconnect`;
    });

    socketRef.current.emit('start', (person) => {
      typeRef.current = person;
    });

    socketRef.current.on('remote-socket', (id) => {
      remoteSocketRef.current = id;
      
      // Hide spinner
      const modal = document.querySelector('.modal');
      if (modal) modal.classList.add('hidden');

      peerRef.current = new RTCPeerConnection(getRTCConfig());

      peerRef.current.onnegotiationneeded = async () => {
        await webrtc();
      };

      peerRef.current.onicecandidate = e => {
        socketRef.current?.emit('ice:send', { candidate: e.candidate, to: remoteSocketRef.current });
      };

      start();
    });

    socketRef.current.on('sdp:reply', async ({ sdp, from }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

        if (typeRef.current === 'p2') {
          const ans = await peerRef.current.createAnswer();
          const modifiedSdp = ans.sdp?.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:100\r\n');
          if (modifiedSdp) ans.sdp = modifiedSdp;

          await peerRef.current.setLocalDescription(ans);
          socketRef.current?.emit('sdp:send', { sdp: peerRef.current.localDescription });
        }
      }
    });

    socketRef.current.on('ice:reply', async ({ candidate, from }) => {
      await peerRef.current?.addIceCandidate(candidate);
    });

    socketRef.current.on('roomid', (id) => {
      roomidRef.current = id;
    });

    socketRef.current.on('get-message', (input, type) => {
      setMessages(prev => [...prev, { sender: 'Stranger', text: input }]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [start, webrtc]);

  const contextValue = {
    socket: socketRef.current,
    peer: peerRef.current,
    remoteSocketId: remoteSocketRef.current,
    type: typeRef.current,
    roomId: roomidRef.current,
    myVideoRef,
    strangerVideoRef,
    chatWrapperRef,
    onlineRef,
    sendMessage,
    messages
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};