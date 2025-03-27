import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useVideoChat = () => {
  // Refs for video and audio elements
  const myVideoRef = useRef(null);
  const strangerVideoRef = useRef(null);

  // Socket and WebRTC references
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const remoteSocketRef = useRef(null);
  const typeRef = useRef(null);
  const roomidRef = useRef(null);

  // UI References
  const chatWrapperRef = useRef(null);
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const onlineRef = useRef(null);

  // State management
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Media constraints for low-quality video
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

  // WebRTC configuration
  const getRTCConfig = () => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  });

  // Start media capture
  const startMediaCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(LOW_QUALITY_CONSTRAINTS);
      
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        if (peerRef.current) {
          peerRef.current.addTrack(track, stream);
        }
      });

      return stream;
    } catch (error) {
      console.error('Media capture error:', error);
      setConnectionStatus('error');
    }
  };

  // Send message
  const sendMessage = () => {
    const message = inputRef.current?.value;
    if (message && socketRef.current) {
      socketRef.current.emit('send-message', message, typeRef.current, roomidRef.current);
      
      // Add message to local state
      setMessages(prev => [...prev, { 
        text: message, 
        sender: 'you' 
      }]);

      // Clear input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  // WebRTC connection setup
  const setupWebRTCConnection = () => {
    // Create peer connection
    peerRef.current = new RTCPeerConnection(getRTCConfig());

    // Handle negotiation
    peerRef.current.onnegotiationneeded = async () => {
      try {
        const offer = await peerRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await peerRef.current.setLocalDescription(offer);
        
        // Send offer to server
        socketRef.current?.emit('sdp:send', { 
          sdp: peerRef.current.localDescription 
        });
      } catch (error) {
        console.error('Negotiation error:', error);
      }
    };

    // Handle incoming tracks
    peerRef.current.ontrack = (event) => {
      if (strangerVideoRef.current) {
        strangerVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  // Socket connection and event handlers
  useEffect(() => {
    // Connect to socket server
    socketRef.current = io('https://your-socket-server-url.com');

    // Socket event handlers
    socketRef.current.on('connect', () => {
      setConnectionStatus('connected');
    });

    socketRef.current.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socketRef.current.on('remote-socket', (id) => {
      remoteSocketRef.current = id;
      setupWebRTCConnection();
      startMediaCapture();
    });

    socketRef.current.on('get-message', (message, type) => {
      setMessages(prev => [...prev, { 
        text: message, 
        sender: 'stranger' 
      }]);
    });

    // Cleanup
    return () => {
      socketRef.current?.disconnect();
      peerRef.current?.close();
    };
  }, []);

  return {
    // Refs
    myVideoRef,
    strangerVideoRef,
    chatWrapperRef,
    inputRef,
    buttonRef,
    onlineRef,

    // State and methods
    messages,
    onlineUsers,
    connectionStatus,
    sendMessage
  };
};