"use client";

import { useState, useEffect, useRef } from "react";

export function getTypingDelay(char: string, baseSpeed: number = 18): number {
  if (char === "." || char === "!" || char === "?") {
    return 240;
  }
  if (char === "," || char === ";") {
    return 110;
  }
  if (char === "\n") {
    return 180;
  }
  return baseSpeed;
}

export interface TypewriterProps {
  content: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function Typewriter({
  content,
  speed = 18,
  onComplete,
  className = "",
}: TypewriterProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const isDoneRef = useRef(false);

  useEffect(() => {
    setDisplayedLength(0);
    isDoneRef.current = false;

    if (!content) {
      onComplete?.();
      return;
    }

    let currentIndex = 0;
    let timer: NodeJS.Timeout;

    const streamNextChar = () => {
      if (currentIndex >= content.length) {
        isDoneRef.current = true;
        setDisplayedLength(content.length);
        onComplete?.();
        return;
      }

      currentIndex++;
      setDisplayedLength(currentIndex);

      const char = content[currentIndex - 1];
      const delay = getTypingDelay(char, speed);

      timer = setTimeout(streamNextChar, delay);
    };

    timer = setTimeout(streamNextChar, speed);

    return () => clearTimeout(timer);
  }, [content, speed, onComplete]);

  const isFinished = displayedLength >= content.length;

  return (
    <span
      className={className}
      onClick={() => {
        // Skip animation on click
        if (!isFinished) {
          setDisplayedLength(content.length);
          onComplete?.();
        }
      }}
      title={!isFinished ? "Klik untuk langsung menampilkan semua teks" : undefined}
    >
      {content.slice(0, displayedLength)}
      {!isFinished && (
        <span className="inline-block animate-pulse font-bold text-primary ml-0.5">▊</span>
      )}
    </span>
  );
}
