import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-row-reverse items-center bg-[#020617] overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-1/2 h-full relative">
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/fishing.jpg`}
          className="w-full h-full object-cover"
          initial={{ scale: 1.2, x: 50 }}
          animate={{ scale: 1, x: 0 }}
          transition={{ duration: 4, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#020617]" />
      </div>

      <div className="w-1/2 px-16 relative z-10 pl-24">
        <motion.div
          initial={{ height: 0 }}
          animate={phase >= 1 ? { height: '100px' } : { height: 0 }}
          transition={{ duration: 0.6 }}
          className="w-1 bg-primary absolute left-12 top-0"
        />

        <motion.h2 
          className="text-6xl font-bold leading-tight mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Share your
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-accent"
          >
            best catches
          </motion.div>
        </motion.h2>

        <motion.p 
          className="text-xl text-gray-400 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Post fishing reports, share conditions, and show off your trophy bass to the community.
        </motion.p>
      </div>
    </motion.div>
  );
}