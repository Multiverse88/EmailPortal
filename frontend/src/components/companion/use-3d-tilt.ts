"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface TiltOptions {
  maxTilt?: number; // max rotation in degrees
  perspective?: number; // CSS perspective distance
}

export function use3DTilt(options: TiltOptions = {}) {
  const { maxTilt = 18, perspective = 600 } = options;
  const ref = useRef<HTMLDivElement | null>(null);

  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const [shadowOffset, setShadowOffset] = useState({ x: 0, y: 12 });
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!ref.current || !isHovered) return;

      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate distance normalized between -1 and 1
      const normalizedX = Math.min(Math.max((e.clientX - centerX) / (rect.width / 2), -1), 1);
      const normalizedY = Math.min(Math.max((e.clientY - centerY) / (rect.height / 2), -1), 1);

      const rotateY = normalizedX * maxTilt;
      const rotateX = -normalizedY * maxTilt;

      // Dynamic light source shadow opposite to rotation
      const shadowX = -normalizedX * 16;
      const shadowY = 12 - normalizedY * 8;

      setTilt({ rotateX, rotateY, scale: 1.05 });
      setShadowOffset({ x: shadowX, y: shadowY });
    },
    [isHovered, maxTilt]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [handlePointerMove]);

  const handlePointerEnter = () => setIsHovered(true);
  const handlePointerLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0, scale: 1 });
    setShadowOffset({ x: 0, y: 12 });
  };

  const style: React.CSSProperties = {
    transform: `perspective(${perspective}px) rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg) scale3d(${tilt.scale}, ${tilt.scale}, 1)`,
    transition: isHovered ? "transform 0.08s ease-out" : "transform 0.4s ease-out",
    transformStyle: "preserve-3d",
    willChange: "transform",
  };

  const shadowStyle: React.CSSProperties = {
    filter: `drop-shadow(${shadowOffset.x.toFixed(1)}px ${shadowOffset.y.toFixed(1)}px 16px rgba(38, 22, 22, 0.28))`,
    transition: isHovered ? "filter 0.08s ease-out" : "filter 0.4s ease-out",
  };

  return {
    ref,
    style,
    shadowStyle,
    handlePointerEnter,
    handlePointerLeave,
    isHovered,
  };
}
