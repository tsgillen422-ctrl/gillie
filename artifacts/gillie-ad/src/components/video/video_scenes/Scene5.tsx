import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-primary"
      initial={{ opacity: 0, clipPath: 'circle(0% at center)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at center)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
      
      <div className="relative z-10 text-center flex flex-col items-center px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-6"
        >
          <img src={`${import.meta.env.BASE_URL}images/app-icon.png`} alt="Gillie Logo" className="w-32 h-32 mx-auto rounded-[24%] object-cover drop-shadow-2xl" />
        </motion.div>

        <motion.h1 
          className="text-[12vw] font-black tracking-tight text-white mb-4 drop-shadow-xl"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ y: 30, opacity: 0 }}
          animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 30, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Get Gillie
        </motion.h1>

        <motion.p 
          className="text-[6vw] text-white/90 font-light mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        >
          Stay connected on the water.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 3 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="bg-black text-white px-8 py-5 rounded-2xl font-bold text-2xl flex justify-center items-center shadow-2xl w-full">
            Download on the App Store
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}