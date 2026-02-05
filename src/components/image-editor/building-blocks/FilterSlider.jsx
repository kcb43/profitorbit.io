import React from 'react';

/**
 * FilterSlider - Slider with tick marks and value display
 */
export function FilterSlider({
  activeFilter = 'brightness',
  value = 100,
  min = 0,
  max = 200,
  onChange,
  className = ''
}) {
  const range = max - min;
  const tickMarks = [0, 25, 50, 75, 100, 125, 150, 175, 200];

  const handleChange = (e) => {
    let newValue = Number(e.target.value);
    
    // Snap to nearest tick mark if within 3 units
    const nearestTick = tickMarks.reduce((prev, curr) => {
      return (Math.abs(curr - newValue) < Math.abs(prev - newValue) ? curr : prev);
    });
    
    if (Math.abs(newValue - nearestTick) <= 3 && nearestTick >= min && nearestTick <= max) {
      newValue = nearestTick;
    }
    
    onChange(newValue);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Value */}
      <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
        <span className="capitalize font-medium">{activeFilter}</span>
        <span className="text-gray-900 font-semibold">{value}%</span>
      </div>

      {/* Slider Container */}
      <div className="relative py-1">
        {/* Tick marks */}
        <div className="absolute top-0 left-0 right-0 h-1 flex items-center justify-between pointer-events-none z-0" style={{ marginTop: '6px' }}>
          {tickMarks.map((tick) => {
            if (tick < min || tick > max) return null;
            const position = ((tick - min) / range) * 100;
            return (
              <div
                key={tick}
                className="w-0.5 h-1 bg-gray-400"
                style={{
                  position: 'absolute',
                  left: `${position}%`,
                  transform: 'translateX(-50%)'
                }}
              />
            );
          })}
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          className="modern-slider w-full appearance-none cursor-pointer relative z-10"
          style={{
            background: range > 0
              ? `linear-gradient(to right, rgba(209, 213, 219, 0.6) 0%, rgba(99, 102, 241, 0.8) ${((value - min) / range) * 100}%, rgba(99, 102, 241, 0.8) ${((value - min) / range) * 100}%, rgba(209, 213, 219, 0.6) 100%)`
              : 'rgba(209, 213, 219, 0.6)'
          }}
        />
      </div>
    </div>
  );
}
