import React from 'react';

export default function StageOrnaments() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Supporting Ambient Stage Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(252,248,238,0.45)_0%,rgba(230,230,230,0)_75%)] dark:bg-[radial-gradient(ellipse_at_50%_30%,rgba(30,41,59,0.38)_0%,rgba(24,24,24,0)_80%)]" />

      {/* Sword Fern Frond Silhouette (Nephrolepis exaltata) - Subtle Outer Stage Rail */}
      <svg
        className="absolute top-28 -right-16 sm:top-36 sm:-right-6 w-36 h-52 sm:w-72 sm:h-[22rem] opacity-20 sm:opacity-25 dark:opacity-25 transition-opacity duration-300 fill-[#829280] dark:fill-[#36483e] mix-blend-multiply dark:mix-blend-screen pointer-events-none"
        viewBox="0 0 300 500"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Central Arching Stipe / Rachis */}
        <path d="M 280,30 C 220,120 150,250 30,480 C 31,480 33,480 34,480 C 154,250 223,121 282,30 Z" />

        {/* Pinnate Leaflets (Pinnae) along the central stipe */}
        {/* Top frond tip leaflets */}
        <path d="M 281,30 C 265,35 250,38 238,42 C 248,46 260,47 274,40 Z" />
        <path d="M 270,50 C 250,56 230,62 215,68 C 228,73 245,73 262,62 Z" />

        {/* Upper frond pinnae pairs */}
        <path d="M 258,72 C 235,78 210,88 192,96 C 206,102 226,101 248,87 Z" />
        <path d="M 264,66 C 275,54 285,45 292,40 C 287,55 278,66 270,72 Z" />

        <path d="M 244,98 C 218,106 188,118 168,128 C 184,134 206,132 232,115 Z" />
        <path d="M 252,90 C 268,76 280,65 288,58 C 281,75 270,88 258,96 Z" />

        <path d="M 228,126 C 198,136 164,150 142,162 C 160,168 184,165 214,145 Z" />
        <path d="M 238,116 C 256,100 272,86 282,78 C 272,97 258,112 244,122 Z" />

        {/* Mid frond pinnae pairs (fullest width) */}
        <path d="M 210,158 C 176,170 138,186 112,200 C 132,208 160,203 194,180 Z" />
        <path d="M 222,146 C 244,128 262,112 274,102 C 262,123 246,140 230,152 Z" />

        <path d="M 190,192 C 152,206 110,224 82,240 C 104,248 134,242 172,216 Z" />
        <path d="M 204,178 C 228,158 248,140 262,128 C 248,151 230,170 212,184 Z" />

        <path d="M 168,230 C 128,246 82,266 52,284 C 76,292 108,284 150,256 Z" />
        <path d="M 184,214 C 210,192 232,172 248,158 C 232,183 212,204 192,220 Z" />

        <path d="M 144,270 C 102,288 54,310 22,328 C 48,336 82,326 124,298 Z" />
        <path d="M 162,252 C 190,228 214,206 230,190 C 212,217 190,240 168,258 Z" />

        {/* Lower frond pinnae pairs (tapering down) */}
        <path d="M 118,314 C 78,332 32,354 5,372 C 30,378 62,368 100,340 Z" />
        <path d="M 136,294 C 166,268 192,244 210,226 C 190,255 166,280 142,300 Z" />

        <path d="M 90,360 C 52,378 12,398 -12,414 C 12,420 42,410 78,384 Z" />
        <path d="M 108,340 C 138,312 166,286 186,266 C 164,297 138,324 112,346 Z" />

        <path d="M 60,410 C 28,426 -4,444 -24,458 C -4,462 22,454 52,430 Z" />
        <path d="M 78,390 C 110,360 138,332 158,310 C 136,343 108,372 82,396 Z" />
      </svg>
    </div>
  );
}
