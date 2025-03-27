"use client"

import { Suspense } from 'react';
import VideoChatApp from '../components/Videochatapp';

export default function VideoChatPage() {
  return (
    <div className="h-screen">
      <Suspense fallback={
        <div className="flex justify-center items-center h-full">
          <div className="animate-pulse text-xl text-violet-500">
            Preparing Video Chat...
          </div>
        </div>
      }>
        <VideoChatApp />
      </Suspense>
    </div>
  );
}