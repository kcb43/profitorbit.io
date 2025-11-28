import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Palette, Sparkles } from "lucide-react";
import narutoIcon from "@/assets/naruto-icon.svg?url";
import sakuraIcon from "@/assets/sakura-icon.svg?url";
import kakashiIcon from "@/assets/kakashi-icon.svg?url";

const themes = {
  'default-light': 'Default Light',
  'default-dark': 'Default Dark',
  'money-green-light': 'Money Green Light',
  'money-green-dark': 'Money Green Dark',
};

const animeCharacters = {
  'naruto': {
    name: 'Naruto',
    icon: narutoIcon,
  },
  'sakura': {
    name: 'Sakura',
    icon: sakuraIcon,
  },
  'kakashi': {
    name: 'Kakashi',
    icon: kakashiIcon,
  },
};

export default function Settings() {
  const [currentTheme, setCurrentTheme] = useState('default-light');
  const [selectedCharacter, setSelectedCharacter] = useState('naruto');

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem('theme') || 'default-light';
    const savedCharacter = localStorage.getItem('selectedCharacter') || 'default';
    
    setCurrentTheme(savedTheme);
    setSelectedCharacter(savedCharacter);
  }, []);

  const handleThemeChange = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('theme', theme);
    
    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', theme);
    const themeObj = themes[theme];
    if (themeObj) {
      const root = document.documentElement;
      root.className = theme.includes('dark') ? 'dark' : '';
    }
  };

  const handleCharacterChange = (character) => {
    setSelectedCharacter(character);
    if (character === 'default') {
      localStorage.removeItem('selectedCharacter'); // Clear it so Gamification uses wizard
    } else {
      localStorage.setItem('selectedCharacter', character);
    }
    
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('characterChanged', { detail: { character } }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Customize your app appearance and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-select">App Theme</Label>
              <Select value={currentTheme} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select" className="w-full">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(themes).map(([key, name]) => (
                    <SelectItem key={key} value={key}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Anime Character Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Anime Character</CardTitle>
                <CardDescription>Select your favorite Naruto character for level icons</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anime-theme">Theme Category</Label>
              <Select value="naruto" disabled>
                <SelectTrigger id="anime-theme" className="w-full">
                  <SelectValue>Anime → Naruto</SelectValue>
                </SelectTrigger>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Naruto theme selected (more anime themes coming soon)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="character-select">Character</Label>
              <Select value={selectedCharacter} onValueChange={handleCharacterChange}>
                <SelectTrigger id="character-select" className="w-full">
                  <SelectValue placeholder="Select a character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Default
                      </div>
                      <span>Default (Wizard)</span>
                    </div>
                  </SelectItem>
                  {Object.entries(animeCharacters).map(([key, character]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-3">
                        <img 
                          src={character.icon} 
                          alt={character.name}
                          className="w-8 h-8 object-contain"
                        />
                        <span>{character.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Character Preview */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center p-2">
                  <img 
                    src={animeCharacters[selectedCharacter].icon} 
                    alt={animeCharacters[selectedCharacter].name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {animeCharacters[selectedCharacter].name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This character will appear as your level icon
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

