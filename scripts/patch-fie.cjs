#!/usr/bin/env node
/**
 * patch-fie.cjs
 * Applies all react-filerobot-image-editor customisations via Node.js fs
 * (targeted string replacements + file creation).
 * Replaces patch-package for reliable cross-platform postinstall patching.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const FIE  = path.join(__dirname, '..', 'node_modules', 'react-filerobot-image-editor', 'lib');

/* ── helpers ──────────────────────────────────────────────────────────────── */

function readFile(rel) {
  return fs.readFileSync(path.join(FIE, rel), 'utf8');
}

function writeFile(rel, content) {
  const abs = path.join(FIE, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  console.log('[patch-fie] wrote:', rel);
}

/**
 * Apply a series of [from, to] string replacements to a file.
 * Each replacement is idempotent: if `from` is absent but `to` is
 * already present we skip silently (patch already applied).
 */
function patch(rel, replacements) {
  const abs = path.join(FIE, rel);
  if (!fs.existsSync(abs)) {
    console.warn('[patch-fie] SKIP (not found):', rel);
    return;
  }
  let content = fs.readFileSync(abs, 'utf8');
  let changed  = false;

  for (const [from, to] of replacements) {
    if (content.includes(to)) {
      // Already patched — skip silently (handles cases where `from` ⊂ `to`).
    } else if (content.includes(from)) {
      content = content.replace(from, to);
      changed  = true;
    } else {
      console.warn('[patch-fie] WARNING – pattern not found in:', rel, '\n  Pattern:', from.slice(0, 80) + '…');
    }
  }

  if (changed) {
    fs.writeFileSync(abs, content, 'utf8');
    console.log('[patch-fie] patched:', rel);
  } else {
    console.log('[patch-fie] already patched:', rel);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   1. utils/constants.js  – add SHADOWS to TOOLS_IDS
   ══════════════════════════════════════════════════════════════════════════ */
patch('utils/constants.js', [
  [
    'BLUR:"Blur",THRESHOLD:',
    'BLUR:"Blur",SHADOWS:"Shadows",THRESHOLD:',
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════
   2. custom/finetunes/index.js  – export all custom finetunes
      (Written in full so adding new exports is always idempotent.)
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('custom/finetunes/index.js',
  'export{default as Warmth}from"./Warmth";' +
  'export{default as CustomThreshold}from"./CustomThreshold";' +
  'export{default as Shadows}from"./Shadows";' +
  'export{default as GammaBrightness}from"./GammaBrightness";'
);

/* ══════════════════════════════════════════════════════════════════════════
   3a. custom/finetunes/Shadows.js  – improved Konva filter for shadows
       Linear falloff over lum 0-192 so the effect is visible on typical images.
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('custom/finetunes/Shadows.js',
  'import Konva from"konva";' +
  'import{Factory as KonvaFactory}from"konva/lib/Factory";' +
  'import{getNumberValidator as konvaGetNumberValidator}from"konva/lib/Validators";' +
  'function Shadows(imageData){' +
    'var s=this.shadowsValue();' +
    'if(s===0)return;' +
    'var data=imageData.data;' +
    'for(var i=0;i<data.length;i+=4){' +
      'var lum=(data[i]*299+data[i+1]*587+data[i+2]*114)/1000;' +
      // Linear shadow weight: 1.0 at lum=0, 0 at lum=192, ignores highlights.
      'var factor=Math.max(0,(192-lum)/192);' +
      'if(factor<0.01)continue;' +
      'var adj=Math.round(s*factor);' +
      'data[i]=Math.min(255,Math.max(0,data[i]+adj));' +
      'data[i+1]=Math.min(255,Math.max(0,data[i+1]+adj));' +
      'data[i+2]=Math.min(255,Math.max(0,data[i+2]+adj));' +
    '}' +
  '}' +
  'Shadows.finetuneName="Shadows";' +
  'export default Shadows;' +
  'KonvaFactory.addGetterSetter(Konva.Image,"shadowsValue",0,konvaGetNumberValidator(),KonvaFactory.afterSetFilter);'
);

/* ══════════════════════════════════════════════════════════════════════════
   3b. custom/finetunes/GammaBrightness.js  – gamma-curve brightness filter
       Replaces Konva.Filters.Brighten (additive/overlay) with proper midtone
       adjustment: output = (input/255)^gamma * 255, gamma = 2^(-slider/50).
       Slider range -100 to 100. At 0: no change. At +100: ~+2 stops. -100: ~-2 stops.
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('custom/finetunes/GammaBrightness.js',
  'import Konva from"konva";' +
  'import{Factory as KonvaFactory}from"konva/lib/Factory";' +
  'import{getNumberValidator as konvaGetNumberValidator}from"konva/lib/Validators";' +
  'function GammaBrightness(imageData){' +
    'var b=this.gammaBrightness();' +
    'if(b===0)return;' +
    'var gamma=Math.pow(2,-b/50);' +
    'var lut=new Uint8ClampedArray(256);' +
    'for(var i=0;i<256;i++)lut[i]=Math.round(Math.pow(i/255,gamma)*255);' +
    'var data=imageData.data;' +
    'for(var j=0;j<data.length;j+=4){' +
      'data[j]=lut[data[j]];' +
      'data[j+1]=lut[data[j+1]];' +
      'data[j+2]=lut[data[j+2]];' +
    '}' +
  '}' +
  'GammaBrightness.finetuneName="GammaBrightness";' +
  'export default GammaBrightness;' +
  'KonvaFactory.addGetterSetter(Konva.Image,"gammaBrightness",0,konvaGetNumberValidator(),KonvaFactory.afterSetFilter);'
);

/* ══════════════════════════════════════════════════════════════════════════
   3c. components/tools/Brightness/BrightnessOptions.js
       Replace Konva.Filters.Brighten (linear) with our GammaBrightness filter.
       Slider range becomes -100..100 (was -1..1), step 1 (was 0.05).
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('components/tools/Brightness/BrightnessOptions.js',
  'import _slicedToArray from"@babel/runtime/helpers/slicedToArray";' +
  'import React from"react";' +
  'import{GammaBrightness}from"../../../custom/finetunes";' +
  'import{useFinetune}from"../../../hooks";' +
  'import restrictNumber from"../../../utils/restrictNumber";' +
  'import Slider from"../../common/Slider";' +
  'import{StyledSliderContainer,StyledSliderInput,StyledSliderLabel,StyledSliderWrapper}from"../tools.styled";' +
  'var MIN_VALUE=-100,DEFAULT_VALUE={gammaBrightness:0},MAX_VALUE=100,sliderStyle={width:150,padding:0,margin:0},' +
  'BrightnessOptions=function(a){' +
    'var b,c,d=a.t,' +
    'e=useFinetune(GammaBrightness,DEFAULT_VALUE),' +
    'f=_slicedToArray(e,2),g=f[0],h=f[1],' +
    'i=function(a){h({gammaBrightness:restrictNumber(a,MIN_VALUE,MAX_VALUE)})};' +
    'return React.createElement(StyledSliderContainer,{className:"FIE_brightness-option-wrapper"},' +
      'React.createElement(StyledSliderLabel,{className:"FIE_brightness-option-label"},d("brightness")),' +
      'React.createElement(StyledSliderWrapper,null,' +
        'React.createElement(Slider,{className:"FIE_brightness-option",min:MIN_VALUE,step:1,max:MAX_VALUE,width:"124px",' +
          'value:null!==(b=g.gammaBrightness)&&void 0!==b?b:DEFAULT_VALUE.gammaBrightness,onChange:i,style:sliderStyle}),' +
        'React.createElement(StyledSliderInput,{' +
          'value:null!==(c=g.gammaBrightness)&&void 0!==c?c:DEFAULT_VALUE.gammaBrightness,' +
          'onChange:function onChange(a){var b=a.target.value;return i(b)}' +
        '})' +
      ')' +
    ')' +
  '};' +
  'export default BrightnessOptions;'
);

/* ══════════════════════════════════════════════════════════════════════════
   4. components/tools/Shadows/*  – UI components for the Shadows tool
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('components/tools/Shadows/Shadows.js',
  'import React from"react";' +
  'import{Shadow as ShadowIcon}from"@scaleflex/icons/shadow";' +
  'import ToolsBarItemButton from"../../ToolsBar/ToolsBarItemButton";' +
  'import{TOOLS_IDS}from"../../../utils/constants";' +
  'var Shadows=function(a){' +
    'var b=a.selectTool,c=a.isSelected;' +
    'return React.createElement(ToolsBarItemButton,{' +
      'className:"FIE_shadows-tool-button",' +
      'id:TOOLS_IDS.SHADOWS,' +
      'label:"Shadows",' +
      'Icon:ShadowIcon,' +
      'onClick:b,' +
      'isSelected:c' +
    '})' +
  '};' +
  'Shadows.defaultProps={isSelected:!1};' +
  'export default Shadows;'
);

writeFile('components/tools/Shadows/ShadowsOptions.js',
  'import _slicedToArray from"@babel/runtime/helpers/slicedToArray";' +
  'import React from"react";' +
  'import{useFinetune}from"../../../hooks";' +
  'import restrictNumber from"../../../utils/restrictNumber";' +
  'import{Shadows as CustomShadows}from"../../../custom/finetunes";' +
  'import Slider from"../../common/Slider";' +
  'import{StyledSliderContainer,StyledSliderInput,StyledSliderLabel,StyledSliderWrapper}from"../tools.styled";' +
  'var MIN_VALUE=-100,DEFAULT_VALUE={shadowsValue:0},MAX_VALUE=100,sliderStyle={width:150,padding:0,margin:0},' +
  'ShadowsOptions=function(a){' +
    'var b,c,' +
    'd=useFinetune(CustomShadows,DEFAULT_VALUE),' +
    'e=_slicedToArray(d,2),f=e[0],g=e[1],' +
    'h=function(a){g({shadowsValue:restrictNumber(a,MIN_VALUE,MAX_VALUE)})};' +
    'return React.createElement(StyledSliderContainer,{className:"FIE_shadows-option-wrapper"},' +
      'React.createElement(StyledSliderLabel,{className:"FIE_shadows-option-label"},"Shadows"),' +
      'React.createElement(StyledSliderWrapper,null,' +
        'React.createElement(Slider,{className:"FIE_shadows-option",min:MIN_VALUE,max:MAX_VALUE,width:"124px",' +
          'value:null!==(b=f.shadowsValue)&&void 0!==b?b:DEFAULT_VALUE.shadowsValue,onChange:h,style:sliderStyle}),' +
        'React.createElement(StyledSliderInput,{' +
          'value:null!==(c=f.shadowsValue)&&void 0!==c?c:DEFAULT_VALUE.shadowsValue,' +
          'onChange:function onChange(a){var b=a.target.value;return h(b)}' +
        '})' +
      ')' +
    ')' +
  '};' +
  'export default ShadowsOptions;'
);

writeFile('components/tools/Shadows/index.js',
  'export{default as Shadows}from"./Shadows";' +
  'export{default as ShadowsOptions}from"./ShadowsOptions";'
);

/* ══════════════════════════════════════════════════════════════════════════
   5. components/tools/tools.constants.js
      • Import Shadows components
      • Add 11th _defineProperty opener (balances the new SHADOWS entry)
      • Insert SHADOWS entry before FILTERS
      • Replace FINETUNE tab tools
   ══════════════════════════════════════════════════════════════════════════ */
patch('components/tools/tools.constants.js', [
  // 5a. Add Shadows import (after Warmth import)
  [
    'import{Warmth,WarmthOptions}from"./Warmth";import{Filters}',
    'import{Warmth,WarmthOptions}from"./Warmth";import{Shadows,ShadowsOptions}from"./Shadows";import{Filters}',
  ],
  // 5b. Add an 11th _defineProperty( opener so the closing parens balance
  //     after we insert the new SHADOWS entry.
  [
    // Original: 10 openers
    'export var TOOLS_ITEMS=(_TOOLS_ITEMS={},' +
      '_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(' +
      '_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(' +
      '_TOOLS_ITEMS,TOOLS_IDS.CROP,',
    // Patched: 11 openers
    'export var TOOLS_ITEMS=(_TOOLS_ITEMS={},' +
      '_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(' +
      '_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(' +
      '_defineProperty(' +
      '_TOOLS_ITEMS,TOOLS_IDS.CROP,',
  ],
  // 5c. Insert SHADOWS entry between WARMTH and FILTERS
  [
    '}),TOOLS_IDS.FILTERS,{id:TOOLS_IDS.FILTERS,Item:Filters})',
    '}),TOOLS_IDS.SHADOWS,{id:TOOLS_IDS.SHADOWS,Item:Shadows,ItemOptions:ShadowsOptions}),TOOLS_IDS.FILTERS,{id:TOOLS_IDS.FILTERS,Item:Filters})',
  ],
  // 5d. Replace FINETUNE tab: swap HSV/BLUR/WARMTH → SHADOWS
  [
    'TABS_IDS.FINETUNE,[TOOLS_IDS.BRIGHTNESS,TOOLS_IDS.CONTRAST,TOOLS_IDS.HSV,TOOLS_IDS.BLUR,TOOLS_IDS.WARMTH]',
    'TABS_IDS.FINETUNE,[TOOLS_IDS.BRIGHTNESS,TOOLS_IDS.CONTRAST,TOOLS_IDS.SHADOWS]',
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════
   6. CropTransformer.js  – centre the crop box when a preset ratio is active
   ══════════════════════════════════════════════════════════════════════════ */
patch('components/Layers/TransformersLayer/CropTransformer.js', [
  [
    // Original saveBoundedCropWithLatestConfig body (function E)
    'var f=t.current,g={width:a,height:b,' +
      'x:null!==(c=j.x)&&void 0!==c?c:0,' +
      'y:null!==(d=j.y)&&void 0!==d?d:0};' +
      'D(boundResizing(g,g,_objectSpread(_objectSpread({},f),{},{abstractX:0,abstractY:0}),' +
        '!(A||B)&&C(),_objectSpread(_objectSpread({},v),e)),!0)',
    // Patched: compute centred x/y when a numeric ratio preset is active
    'var f=t.current,' +
      '_ratio=!(A||B)&&C(),_w=a,_h=b,_x,_y;' +
      'if(f&&typeof _ratio===\'number\'){' +
        'if(a>0&&b>0&&a/b>_ratio){_w=b*_ratio;_h=b;}' +
        'else if(a>0&&b>0){_w=a;_h=a/_ratio;}' +
        '_x=(f.width-_w)/2;_y=(f.height-_h)/2;' +
      '}else{' +
        '_x=null!==(c=j.x)&&void 0!==c?c:0;' +
        '_y=null!==(d=j.y)&&void 0!==d?d:0;' +
      '}' +
      'var g={width:_w,height:_h,x:Math.max(0,_x),y:Math.max(0,_y)};' +
      'D(boundResizing(g,g,_objectSpread(_objectSpread({},f),{},{abstractX:0,abstractY:0}),' +
        '_ratio,_objectSpread(_objectSpread({},v),e)),!0)',
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════
   7. DesignLayer/index.js  – fix cache pixel ratio for HiDPI screens
      Konva.Node.cache() defaults to pixelRatio:1. On a 2× screen this creates
      a 1× cache canvas that gets upscaled to the 2× stage → blurry preview.
      Passing {pixelRatio: devicePixelRatio} makes the cache match the screen.
   ══════════════════════════════════════════════════════════════════════════ */
patch('components/Layers/DesignLayer/index.js', [
  [
    'J.current?J.current.cache():setTimeout(Y,0)',
    'J.current?J.current.cache({pixelRatio:window.devicePixelRatio||2}):setTimeout(Y,0)',
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════
   8. hooks/useTransformedImgData.js
   8a. Raise default save quality 92 → 97 (near-lossless for product photos).
   8b. Fix save-path cache resolution.
       Root cause: y.cache() creates an 800px cache, but the save layer has
       scaleX = originalWidth/displayWidth (e.g. 5.04 for 4032/800). FIE then
       upscales this 800px cache 5× onto the 4032px output canvas → horribly
       blurry saves. Fix: pass pixelRatio = originalWidth/displayWidth to
       cache() so the cache is created at full original resolution → 1:1 draw.
       Note: y.cache() is called before var z is defined, so we use
       v.width()/d.width directly (same value as z.x that comes after).
   ══════════════════════════════════════════════════════════════════════════ */
patch('hooks/useTransformedImgData.js', [
  [
    'void 0===D?92:D',
    'void 0===D?97:D',
  ],
  [
    'y.cache();',
    'y.cache({pixelRatio:d.width>0?v.width()/d.width:1});',
  ],
]);

console.log('[patch-fie] Done.');
