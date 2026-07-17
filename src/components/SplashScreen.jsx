import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Particle Component ────────────────────────────────────────────────────
function Particle({ angle, delay }) {
  const distance = 85 + Math.random() * 50;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const size = 2 + Math.random() * 3;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `hsl(${140 + Math.random() * 40}, 72%, ${55 + Math.random() * 20}%)`,
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
      }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0 }}
      transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    />
  );
}

// ─── Animated Arc Ring ─────────────────────────────────────────────────────
function ArcRing({ size, strokeWidth, delay }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <motion.svg
      width={size}
      height={size}
      className="absolute"
      style={{ top: '50%', left: '50%', marginTop: -size / 2, marginLeft: -size / 2 }}
      initial={{ rotate: -90, opacity: 0 }}
      animate={{ rotate: 270, opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.8, delay, ease: 'easeInOut' }}
    >
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#arcGradGreen)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.6, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
      />
      <defs>
        <linearGradient id="arcGradGreen" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

// ─── Main Splash Screen ────────────────────────────────────────────────────
export default function SplashScreen({ isVisible }) {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    angle: (360 / 24) * i,
    delay: 0.05 + Math.random() * 0.2,
  }));

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'var(--bg-color)' }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* ── Background ambient glow ── */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 300,
              height: 300,
              background:
                'radial-gradient(circle, rgba(22,163,74,0.16) 0%, rgba(13,148,136,0.08) 50%, transparent 70%)',
              top: '50%',
              left: '50%',
              marginTop: -150,
              marginLeft: -150,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />

          {/* ── Particle burst ── */}
          <div className="absolute" style={{ top: '50%', left: '50%' }}>
            {particles.map((p, i) => (
              <Particle key={i} angle={p.angle} delay={p.delay} />
            ))}
          </div>

          {/* ── Arc rings ── */}
          <ArcRing size={170} strokeWidth={2} delay={0.7} />
          <ArcRing size={210} strokeWidth={1.2} delay={0.95} />

          {/* ── Logo ── */}
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.75,
              delay: 0.2,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          >
            {/* Glow halo */}
            <motion.div
              className="absolute rounded-[38px]"
              style={{
                inset: -14,
                background:
                  'radial-gradient(circle, rgba(22,163,74,0.45) 0%, transparent 70%)',
              }}
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <img
              src="assets/logo.png"
              alt="PocketSafe Logo"
              className="relative z-10 object-cover"
              style={{ width: 100, height: 100, borderRadius: 26, display: 'block' }}
            />
          </motion.div>

          {/* ── Brand name ── */}
          <motion.div
            className="relative z-10 mt-6 text-center"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: '2rem',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                position: 'relative',
                display: 'inline-block',
              }}
            >
              {/* Shimmer sweep overlay */}
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
                  backgroundSize: '200% 100%',
                  zIndex: 1,
                  borderRadius: 4,
                }}
                initial={{ backgroundPosition: '-100% 0' }}
                animate={{ backgroundPosition: '200% 0' }}
                transition={{ duration: 0.9, delay: 0.85, ease: 'easeInOut' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>Pocket</span>
              <span style={{ color: 'var(--primary)' }}>Safe</span>
            </div>

            {/* Tagline */}
            <motion.div
              className="mt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.85, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}
            >
              Your money, your rules 🌱
            </motion.div>
          </motion.div>

          {/* ── Loading bar ── */}
          <motion.div
            className="relative z-10 mt-10 overflow-hidden"
            style={{
              width: 110,
              height: 3,
              borderRadius: 9999,
              background: 'var(--border-color)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.3 }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 9999,
                background: 'linear-gradient(90deg, #16a34a, #0d9488)',
                originX: 0,
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2.0, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
