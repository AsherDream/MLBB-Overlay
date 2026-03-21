import { useCallback } from 'react';

export default function RotationHandle({ onRotate, currentRotation = 0, theme = 'purple' }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.currentTarget.parentElement;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Capture starting angle and rotation
    const startRadians = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const startDegrees = startRadians * (180 / Math.PI);
    const initialRotation = currentRotation || 0;

    const handleMouseMove = (moveEvent) => {
      const radians = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const degrees = radians * (180 / Math.PI);
      
      let delta = degrees - startDegrees;

      // Normalize delta to shortest path
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      let final = initialRotation + delta;

      // Normalize final angle to [-180, 180]
      if (final <= -180) final += 360;
      if (final > 180) final -= 360;

      // Next-Level Feature: Hold Shift to snap to 15-degree increments!
      if (moveEvent.shiftKey) {
        final = Math.round(final / 15) * 15;
      } else {
        final = Math.round(final);
      }

      onRotate(final);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onRotate, currentRotation]);

  const colors = theme === 'blue' 
    ? 'bg-blue-500 border-white text-white shadow-[0_0_10px_rgba(59,130,246,0.6)]' 
    : 'bg-[#1a1625] border-[#a78bfa] text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.4)] hover:bg-[#a78bfa] hover:text-white';

  return (
    <div
      className={`absolute -bottom-10 left-1/2 -translate-x-1/2 w-8 h-8 border-2 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto z-[60] transition-colors ${colors}`}
      onMouseDown={handleMouseDown}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.82l1.25 1.25"/>
      </svg>
    </div>
  );
}
