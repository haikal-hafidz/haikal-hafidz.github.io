import React from 'react';

export default function StageOrnaments() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Supporting Ambient Vignette Layer */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(252,248,238,0.45)_0%,rgba(230,230,230,0)_75%)] dark:bg-[radial-gradient(ellipse_at_50%_35%,rgba(30,41,59,0.38)_0%,rgba(24,24,24,0)_80%)]" />

      {/* Abstract Organic Silhouette - Top Left Corner */}
      <svg
        className="absolute -top-12 -left-16 w-[20rem] h-[20rem] sm:w-[32rem] sm:h-[32rem] opacity-35 dark:opacity-20 transition-opacity duration-300 fill-[#b8ac98] dark:fill-[#334155] mix-blend-multiply dark:mix-blend-screen"
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M 120,20 C 220,10 310,80 340,180 C 370,280 290,380 180,410 C 80,440 10,350 20,240 C 30,130 50,30 120,20 Z" />
        <path d="M 280,0 C 380,40 460,130 440,240 C 420,350 310,420 210,390 C 180,380 260,260 300,180 C 340,100 220,20 280,0 Z" />
      </svg>

      {/* Abstract Organic Silhouette - Bottom Right Corner */}
      <svg
        className="absolute -bottom-16 -right-16 w-[22rem] h-[22rem] sm:w-[36rem] sm:h-[36rem] opacity-30 dark:opacity-15 transition-opacity duration-300 fill-[#c2b6a2] dark:fill-[#1e293b] mix-blend-multiply dark:mix-blend-screen"
        viewBox="0 0 500 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M 380,480 C 280,490 190,420 160,320 C 130,220 210,120 320,90 C 420,60 490,150 480,260 C 470,370 450,470 380,480 Z" />
        <path d="M 220,500 C 120,460 40,370 60,260 C 80,150 190,80 290,110 C 320,120 240,240 200,320 C 160,400 280,480 220,500 Z" />
      </svg>
    </div>
  );
}
