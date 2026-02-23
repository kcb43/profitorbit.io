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
   2. custom/finetunes/index.js  – export the Shadows finetune
   ══════════════════════════════════════════════════════════════════════════ */
patch('custom/finetunes/index.js', [
  [
    'export{default as CustomThreshold}from"./CustomThreshold";',
    'export{default as CustomThreshold}from"./CustomThreshold";export{default as Shadows}from"./Shadows";',
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════
   3. custom/finetunes/Shadows.js  – new Konva filter for shadows
   ══════════════════════════════════════════════════════════════════════════ */
writeFile('custom/finetunes/Shadows.js',
  'import Konva from"konva";' +
  'import{Factory as KonvaFactory}from"konva/lib/Factory";' +
  'import{getNumberValidator as konvaGetNumberValidator}from"konva/lib/Validators";' +
  'function Shadows(imageData){' +
    'var s=this.shadowsValue();var data=imageData.data;' +
    'for(var i=0;i<data.length;i+=4){' +
      'var r=data[i],g=data[i+1],b=data[i+2];' +
      'var lum=0.299*r+0.587*g+0.114*b;' +
      'var factor=Math.pow(Math.max(0,1-lum/255),1.5);' +
      'var adj=s*factor;' +
      'data[i]=Math.min(255,Math.max(0,r+adj));' +
      'data[i+1]=Math.min(255,Math.max(0,g+adj));' +
      'data[i+2]=Math.min(255,Math.max(0,b+adj));' +
    '}' +
  '}' +
  'Shadows.finetuneName="Shadows";' +
  'export default Shadows;' +
  'KonvaFactory.addGetterSetter(Konva.Image,"shadowsValue",0,konvaGetNumberValidator(),KonvaFactory.afterSetFilter);'
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

console.log('[patch-fie] Done.');
