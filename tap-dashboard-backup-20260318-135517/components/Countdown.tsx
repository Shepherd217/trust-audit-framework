'use client';

import { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: string;
}

export default function Countdown({ targetDate }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLessThan24h, setIsLessThan24h] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - Date.now();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        setTimeLeft({ days, hours, minutes, seconds });
        setIsLessThan24h(difference < 24 * 60 * 60 * 1000);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className={`text-center ${isLessThan24h ? 'animate-pulse' : ''}`}>
      <p className="text-[#71717A] text-sm mb-2 uppercase tracking-wider">Network opens in</p>
      <div className="flex items-center justify-center gap-3">
        {[
          { value: timeLeft.days, label: 'DAYS' },
          { value: timeLeft.hours, label: 'HRS' },
          { value: timeLeft.minutes, label: 'MIN' },
          { value: timeLeft.seconds, label: 'SEC' },
        ].map((item, i) => (
          <div key={item.label} className="text-center">
            <div 
              className={`text-3xl md:text-4xl font-bold tabular-nums ${
                isLessThan24h ? 'text-[#FF3B5C]' : 'text-[#00FF9F]'
              }`}
            >
              {item.value.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] text-[#71717A] mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
