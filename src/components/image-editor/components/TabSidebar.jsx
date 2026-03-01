import React from 'react';
import { Crop, SlidersHorizontal, Type } from 'lucide-react';

const TABS = [
  { id: 'adjust', label: 'Adjust', Icon: Crop },
  { id: 'finetune', label: 'Finetune', Icon: SlidersHorizontal },
  { id: 'watermark', label: 'Watermark', Icon: Type },
];

export default function TabSidebar({ activeTab, onTabChange, isDark }) {
  return (
    <div
      className="flex flex-col items-center pt-4 gap-2 flex-shrink-0"
      style={{
        width: 72,
        background: isDark ? '#161616' : '#f5f5f5',
        borderRight: `1px solid ${isDark ? '#262626' : '#d4d4d4'}`,
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center justify-center gap-1 rounded-lg transition-colors"
            style={{
              width: 56,
              height: 56,
              background: isActive
                ? isDark ? '#2563eb' : '#2563eb'
                : 'transparent',
              color: isActive
                ? '#ffffff'
                : isDark ? '#a3a3a3' : '#525252',
            }}
            title={label}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
