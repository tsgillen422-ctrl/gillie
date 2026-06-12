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
      className="absolute inset-0 flex flex-col justify-end bg-[#020617] overflow-hidden pb-32"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: '-100%' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {/* Blurred Background */}
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/fishing.jpg`}
          className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 5, ease: "easeOut" }}
        />
        
        {/* Device Frame */}
        <motion.div 
          className="relative w-[65%] max-w-[320px] aspect-[9/19.5] bg-black rounded-[3rem] border-[6px] border-zinc-800 shadow-2xl overflow-hidden mt-[-20vh]"
          initial={{ y: 100, rotate: 5, opacity: 0 }}
          animate={{ y: 0, rotate: -2, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/app-map.jpg`} 
            className="w-full h-full object-cover" 
            alt="App Map" 
          />
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent" />
      </div>

      <div className="px-8 relative z-10 w-full text-right flex flex-col items-end">
        <motion.div
          initial={{ width: 0 }}
          animate={phase >= 1 ? { width: '100px' } : { width: 0 }}
          transition={{ duration: 0.6 }}
          className="h-1 bg-primary mb-6"
        />

        <motion.h2 
          className="text-[10vw] font-bold leading-tight mb-4 drop-shadow-lg"
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
          className="text-[5vw] text-gray-200 max-w-[80%]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          Post fishing reports, share conditions, and show off your trophy bass.
        </motion.p>
      </div>
    </motion.div>
  );
}