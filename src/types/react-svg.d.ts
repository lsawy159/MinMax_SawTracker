/**
 * Type declaration to fix ReactSVG import error in lucide-react
 * 
 * ReactSVG is not exported from React, but lucide-react tries to import it.
 * This file extends the React module to provide the ReactSVG type definition.
 * 
 * ReactSVG represents the intrinsic SVG elements available in React JSX,
 * which are used by lucide-react to type-check SVG element names.
 */

import 'react'

declare module 'react' {
  /**
   * ReactSVG represents the type of all SVG intrinsic elements in React.
   * This type is used to get the keys (element names) of SVG elements
   * like 'svg', 'path', 'circle', 'rect', etc.
   * 
   * Using JSX.IntrinsicElements provides all HTML and SVG element types,
   * which allows keyof ReactSVG to work correctly for SVG element names.
   */
  export type ReactSVG = JSX.IntrinsicElements
}

