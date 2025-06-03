import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface BingoAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export default function BingoAnimation({ isVisible, onComplete }: BingoAnimationProps) {
  useEffect(() => {
    if (isVisible) {
      // Trigger confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          onComplete?.();
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          zIndex: 999,
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="text-6xl font-bold text-challenge-purple bg-white/90 px-8 py-4 rounded-lg shadow-lg"
          >
            BINGO!
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 