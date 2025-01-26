"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTimer = setTimeout(() => setIsLoaded(true), 100);
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-all duration-500 ease-in-out ${
        isLoaded ? "opacity-100" : "opacity-0"
      } ${!isVisible ? "pointer-events-none" : ""}`}
    >
      {/* Fullscreen Blurred Background (Desktop Only) */}
      <div className="absolute inset-0 hidden md:block">
        <Image
          src="/images/OctaveBanner.png" // Replace with your banner image
          alt="Background Overlay"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          className="object-cover blur-md opacity-50"
        />
      </div>

      <div className="relative flex flex-col items-center justify-center space-y-8 z-10">
        {/* Loading Circle */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-700 border-t-white rounded-full animate-spin-slow" />
        </div>

        {/* Mobile-Only Banner */}
        <div className="relative w-64 h-32 md:hidden">
          <Image
            src="/images/OctaveBanner.png"
            alt="SamJ Music"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain animate-bounce-slow"
          />
        </div>


        {/* Made with love text */}
        <div className="flex items-center space-x-2 text-gray-400">
          <span>Made with 🥨</span>
          <span>by SamJ (BETA, things will not work, especially on a phone)</span>
        </div>
      </div>
    </div>
  );
}
