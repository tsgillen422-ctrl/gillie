import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-end bg-[#020617] overflow-hidden pb-32"
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '-100%', opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 z-0">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/friends-boat.jpg`}
          className="w-full h-full object-cover opacity-80"
          initial={{ scale: 1.2, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 5, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/50 to-transparent" />
      </div>

      <div className="px-8 relative z-10 w-full">
        <motion.div
          initial={{ width: 0 }}
          animate={phase >= 1 ? { width: '100px' } : { width: 0 }}
          transition={{ duration: 0.6 }}
          className="h-1 bg-accent mb-6"
        />

        <motion.h2 
          className="text-[10vw] font-bold leading-tight mb-4 drop-shadow-lg"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            See friends
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-primary"
          >
            on the water
          </motion.div>
        </motion.h2>

        <motion.p 
          className="text-[5vw] text-gray-200"
          initial={{ opacity: 0, x: 20 }}
          animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          transition={{ duration: 0.6 }}
        >
          Live map tracking so you never miss out on the action.
        </motion.p>
      </div>
    </motion.div>
  );
}