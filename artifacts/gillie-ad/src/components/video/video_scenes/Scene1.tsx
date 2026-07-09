import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 z-0">
        <video 
          src={`${import.meta.env.BASE_URL}videos/hero-lake.mp4`}
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
      </div>

      <div className="relative z-10 text-center px-10 flex flex-col items-center">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-primary/20 text-primary border border-primary/30 px-6 py-2 rounded-full font-semibold tracking-wider uppercase text-sm mb-8"
        >
          Your Lake Community
        </motion.div>

        <motion.h1 
          className="text-[15vw] font-black tracking-tight leading-none mb-4 drop-shadow-2xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {'GILLIE'.split('').map((char, i) => (
            <motion.span key={i} style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 100, rotateX: -90 }}
              animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: -90 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: phase >= 2 ? i * 0.05 : 0 }}>
              {char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p 
          className="text-[6vw] font-light text-gray-200"
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={phase >= 3 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          The Social Map for Boaters
        </motion.p>
      </div>
    </motion.div>
  );
}