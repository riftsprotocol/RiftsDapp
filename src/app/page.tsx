'use client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import BackgroundFX from '@/components/BackgroundFX';
import { AnimatePresence, motion } from 'framer-motion';

// Lazy load heavy components
const Protocol = lazy(() => import('@/components/Protocol'));
const Stats = lazy(() => import('@/components/Stats'));
const Footer = lazy(() => import('@/components/Footer'));

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative">
      <BackgroundFX />
      
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          >
            <div className="text-2xl font-mono text-glow flex items-center gap-4">
              <motion.div 
                className="w-4 h-4 rounded-full bg-green-400"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
              Connecting to Volatility Core...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <>
          <Header />
          <main className="relative z-10">
            <Hero />
            <Suspense fallback={<div className="min-h-[200px] bg-black/50 animate-pulse" />}>
              <Stats />
            </Suspense>
            <Suspense fallback={<div className="min-h-[400px] bg-black/50 animate-pulse" />}>
              <Protocol />
            </Suspense>
          </main>
          <Suspense fallback={<div className="min-h-[200px] bg-black/50 animate-pulse" />}>
            <Footer />
          </Suspense>
        </>
      )}
      
      <Toaster />
    </div>
  );
}