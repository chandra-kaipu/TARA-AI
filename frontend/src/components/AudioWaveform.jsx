import React from 'react';
import { motion } from 'framer-motion';

export default function AudioWaveform({ isActive, isSpeaking, size = 'md' }) {
  const bars = [0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.4];

  const heights = size === 'sm' ? [12, 18, 24] : [16, 28, 38];

  return (
    <div className="flex items-center justify-center gap-1 h-8 px-2">
      {bars.map((weight, i) => (
        <motion.span
          key={i}
          className={`w-1 rounded-full ${
            isSpeaking 
              ? 'bg-[#DA7756]' 
              : isActive 
              ? 'bg-[#4F7A5C]' 
              : 'bg-[#E3E0D8] dark:bg-[#423F3A]'
          }`}
          animate={{
            height: isActive || isSpeaking
              ? [8, heights[1] * weight, 8]
              : 6,
            opacity: isActive || isSpeaking ? [0.6, 1, 0.6] : 0.4
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  );
}
