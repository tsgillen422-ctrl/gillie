import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 overflow-hidden bg-[#020617]"
      initial={{ scale: 1.5, opacity: 0, rotate: 5 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 z-0">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/tie-up.jpg`}
          className="w-full h-full object-cover opacity-50"
          initial={{ scale: 1 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: 5, ease: "linear" }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-10">
        <motion.div
          className="w-24 h-24 rounded-full border-4 border-accent mb-8 flex items-center justify-center text-4xl font-bold bg-accent/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
        >
          ⚓
        </motion.div>

        <motion.h2 
          className="text-7xl font-bold leading-tight mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
            animate={phase >= 2 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 50, filter: 'blur(10px)' }}
            transition={{ duration: 0.8 }}
          >
            Find tie-ups &
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
            animate={phase >= 2 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 50, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-primary"
          >
            lake events
          </motion.div>
        </motion.h2>

        <motion.p 
          className="text-2xl text-gray-300 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Discover where the party is. Join public tie-ups or create private ones for your friends.
        </motion.p>
      </div>
    </motion.div>
  );
}