/*! ShapeField — ModernVivo hero visual (three.js scene, geometry + config baked in)
 *  three is bundled by esbuild. Orchestrated by hero.js (mount + reveal), not self-initializing.
 *  Usage:  new ShapeField(mountEl, { ...overrides })  ·  .replay()  ·  .destroy()
 */
import * as THREE from 'three';

// baked shape-09 geometry — parsed from the SVG at build time. [x, y, w, h, square?] with x,y,w,h in shape-space (~[-1..1])
const SHAPES =
[
  { fill: "#BD85FF", pts: [[0.285,0.879,0.067,0.067,1],[0.163,0.838,0.067,0.067,1],[-0.204,0.797,0.067,0.067,1],[0.285,0.593,0.067,0.067,1],[-0.774,0.552,0.067,0.067,1],[-0.448,0.511,0.067,0.067,1],[-0.407,0.511,0.067,0.067,1],[-0.774,0.47,0.067,0.067,1],[-0.082,0.47,0.067,0.067,1],[0.448,0.47,0.067,0.067,1],[-0.163,0.429,0.067,0.067,1],[0.407,0.429,0.067,0.067,1],[-0.367,0.389,0.067,0.067,1],[-0.244,0.348,0.067,0.067,1],[0.53,0.348,0.067,0.067,1],[0.57,0.348,0.067,0.067,1],[0.733,0.348,0.067,0.067,1],[-0.896,0.307,0.067,0.067,1],[-0.122,0.307,0.067,0.067,1],[-0.041,0.307,0.067,0.067,1],[0.448,0.307,0.067,0.067,1],[-0.733,0.225,0.067,0.067,1],[-0.041,0.225,0.067,0.067,1],[-0.774,0.184,0.067,0.067,1],[-0.693,0.184,0.067,0.067,1],[-0.489,0.184,0.067,0.067,1],[-0.448,0.184,0.067,0.067,1],[0.285,0.184,0.067,0.067,1],[0.448,0.184,0.067,0.067,1],[-0.652,0.143,0.067,0.067,1],[-0.53,0.143,0.067,0.067,1],[-0.489,0.143,0.067,0.067,1],[-0.448,0.143,0.067,0.067,1],[-0.774,0.102,0.067,0.067,1],[-0.448,0.102,0.067,0.067,1],[0.856,0.102,0.067,0.067,1],[0.57,0.061,0.067,0.067,1],[0.407,0.02,0.067,0.067,1],[-0.733,-0.02,0.067,0.067,1],[0.611,-0.02,0.067,0.067,1],[-0.163,-0.061,0.067,0.067,1],[-0.041,-0.061,0.067,0.067,1],[0.856,-0.061,0.067,0.067,1],[-0.204,-0.143,0.067,0.067,1],[0.204,-0.143,0.067,0.067,1],[-0.611,-0.184,0.067,0.067,1],[0.163,-0.184,0.067,0.067,1],[0.326,-0.184,0.067,0.067,1],[0.815,-0.184,0.067,0.067,1],[-0.244,-0.225,0.067,0.067,1],[0.815,-0.225,0.067,0.067,1],[-0.733,-0.266,0.067,0.067,1],[0.815,-0.266,0.067,0.067,1],[0.245,-0.348,0.067,0.067,1],[0.652,-0.348,0.067,0.067,1],[0.774,-0.429,0.067,0.067,1],[-0.407,-0.511,0.067,0.067,1],[0.163,-0.593,0.067,0.067,1],[-0.204,-0.634,0.067,0.067,1],[-0.163,-0.634,0.067,0.067,1],[-0.407,-0.716,0.067,0.067,1],[-0.407,-0.756,0.067,0.067,1],[0.53,-0.756,0.067,0.067,1],[-0.204,-0.879,0.067,0.067,1],[0,-0.92,0.067,0.067,1]] },
  { fill: "#F59CF4", pts: [[0,0.838,0.068,0.067,0],[-0.407,0.756,0.068,0.067,0],[0.204,0.756,0.068,0.067,0],[-0.367,0.716,0.068,0.067,0],[-0.082,0.716,0.068,0.067,0],[-0.448,0.675,0.068,0.067,0],[-0.326,0.675,0.068,0.067,0],[-0.611,0.634,0.068,0.067,0],[-0.57,0.634,0.068,0.067,0],[-0.448,0.634,0.068,0.067,0],[0.407,0.634,0.068,0.067,0],[0.244,0.552,0.068,0.067,0],[0.57,0.552,0.068,0.067,0],[0.611,0.552,0.068,0.067,0],[0.53,0.511,0.068,0.067,0],[-0.163,0.47,0.068,0.067,0],[0.204,0.47,0.068,0.067,0],[-0.652,0.389,0.068,0.067,0],[-0.57,0.389,0.068,0.067,0],[0.326,0.348,0.068,0.067,0],[0.367,0.348,0.068,0.067,0],[-0.285,0.307,0.068,0.067,0],[0.122,0.307,0.068,0.067,0],[0.244,0.307,0.068,0.067,0],[-0.407,0.225,0.068,0.067,0],[0.448,0.225,0.068,0.067,0],[-0.407,0.184,0.068,0.067,0],[-0.774,0.143,0.068,0.067,0],[-0.57,0.102,0.068,0.067,0],[-0.245,0.102,0.068,0.067,0],[0.57,0.102,0.068,0.067,0],[-0.611,0.061,0.068,0.067,0],[-0.57,0.061,0.068,0.067,0],[-0.693,-0.02,0.068,0.067,0],[-0.53,-0.02,0.068,0.067,0],[-0.204,-0.02,0.068,0.067,0],[-0.652,-0.061,0.068,0.067,0],[0.733,-0.061,0.068,0.067,0],[0,-0.143,0.068,0.067,0],[-0.367,-0.348,0.068,0.067,0],[-0.652,-0.388,0.068,0.067,0],[-0.53,-0.716,0.068,0.067,0],[-0.245,-0.756,0.068,0.067,0],[-0.163,-0.838,0.068,0.067,0],[-0.163,-0.879,0.068,0.067,0],[-0.204,-0.92,0.068,0.067,0]] },
  { fill: "#16BAC5", pts: [[-0.082,0.879,0.068,0.067,0],[-0.041,0.838,0.068,0.067,0],[0.122,0.797,0.068,0.067,0],[-0.285,0.716,0.068,0.067,0],[-0.53,0.675,0.068,0.067,0],[-0.367,0.675,0.068,0.067,0],[-0.448,0.593,0.068,0.067,0],[-0.041,0.593,0.068,0.067,0],[0.652,0.552,0.068,0.067,0],[-0.611,0.511,0.068,0.067,0],[-0.53,0.511,0.068,0.067,0],[-0.082,0.511,0.068,0.067,0],[0.367,0.47,0.068,0.067,0],[-0.815,0.429,0.068,0.067,0],[0.448,0.429,0.068,0.067,0],[0.53,0.429,0.068,0.067,0],[0.285,0.389,0.068,0.067,0],[0.733,0.389,0.068,0.067,0],[0.285,0.348,0.068,0.067,0],[0.815,0.348,0.068,0.067,0],[-0.774,0.307,0.068,0.067,0],[-0.367,0.307,0.068,0.067,0],[0.204,0.307,0.068,0.067,0],[0.693,0.307,0.068,0.067,0],[0.733,0.307,0.068,0.067,0],[0.815,0.307,0.068,0.067,0],[0,0.266,0.068,0.067,0],[0.815,0.143,0.068,0.067,0],[-0.611,0.102,0.068,0.067,0],[-0.733,0.02,0.068,0.067,0],[0.733,0.02,0.068,0.067,0],[-0.082,-0.02,0.068,0.067,0],[0.367,-0.02,0.068,0.067,0],[-0.53,-0.061,0.068,0.067,0],[0.774,-0.061,0.068,0.067,0],[-0.693,-0.102,0.068,0.067,0],[-0.082,-0.143,0.068,0.067,0],[0.285,-0.143,0.068,0.067,0],[-0.489,-0.184,0.068,0.067,0],[0.122,-0.184,0.068,0.067,0],[0.855,-0.184,0.068,0.067,0],[-0.693,-0.266,0.068,0.067,0],[-0.652,-0.307,0.068,0.067,0],[0.489,-0.307,0.068,0.067,0],[0.611,-0.307,0.068,0.067,0],[0.326,-0.348,0.068,0.067,0],[-0.407,-0.429,0.068,0.067,0],[-0.448,-0.552,0.068,0.067,0],[-0.407,-0.634,0.068,0.067,0],[0.489,-0.634,0.068,0.067,0],[-0.367,-0.675,0.068,0.067,0],[-0.326,-0.675,0.068,0.067,0],[-0.489,-0.716,0.068,0.067,0],[-0.041,-0.797,0.068,0.067,0],[0,-0.797,0.068,0.067,0],[0.081,-0.92,0.068,0.067,0]] },
  { fill: "#8D04FD", pts: [[-0.041,0.797,0.068,0.067,0],[0,0.797,0.068,0.067,0],[0.041,0.797,0.068,0.067,0],[0.082,0.797,0.068,0.067,0],[0.204,0.797,0.068,0.067,0],[-0.204,0.756,0.068,0.067,0],[-0.163,0.756,0.068,0.067,0],[-0.041,0.756,0.068,0.067,0],[0.163,0.756,0.068,0.067,0],[0.244,0.756,0.068,0.067,0],[-0.041,0.716,0.068,0.067,0],[0.204,0.716,0.068,0.067,0],[0.285,0.716,0.068,0.067,0],[-0.652,0.675,0.068,0.067,0],[-0.489,0.675,0.068,0.067,0],[-0.041,0.675,0.068,0.067,0],[0.163,0.675,0.068,0.067,0],[0.326,0.675,0.068,0.067,0],[-0.407,0.634,0.068,0.067,0],[-0.285,0.634,0.068,0.067,0],[-0.245,0.634,0.068,0.067,0],[-0.204,0.634,0.068,0.067,0],[0.326,0.634,0.068,0.067,0],[0.57,0.634,0.068,0.067,0],[-0.611,0.593,0.068,0.067,0],[-0.163,0.593,0.068,0.067,0],[-0.122,0.593,0.068,0.067,0],[0.326,0.593,0.068,0.067,0],[0.448,0.593,0.068,0.067,0],[0.489,0.593,0.068,0.067,0],[0.53,0.593,0.068,0.067,0],[0.57,0.593,0.068,0.067,0],[0.611,0.593,0.068,0.067,0],[-0.611,0.552,0.068,0.067,0],[-0.122,0.552,0.068,0.067,0],[-0.082,0.552,0.068,0.067,0],[-0.041,0.552,0.068,0.067,0],[0.285,0.552,0.068,0.067,0],[0.53,0.552,0.068,0.067,0],[-0.367,0.511,0.068,0.067,0],[-0.326,0.511,0.068,0.067,0],[-0.245,0.511,0.068,0.067,0],[0,0.511,0.068,0.067,0],[0.407,0.511,0.068,0.067,0],[0.448,0.511,0.068,0.067,0],[0.489,0.511,0.068,0.067,0],[0.57,0.511,0.068,0.067,0],[-0.57,0.47,0.068,0.067,0],[-0.122,0.47,0.068,0.067,0],[0.082,0.47,0.068,0.067,0],[0.122,0.47,0.068,0.067,0],[0.163,0.47,0.068,0.067,0],[0.244,0.47,0.068,0.067,0],[0.407,0.47,0.068,0.067,0],[0.489,0.47,0.068,0.067,0],[0.53,0.47,0.068,0.067,0],[-0.774,0.429,0.068,0.067,0],[-0.611,0.429,0.068,0.067,0],[0.204,0.429,0.068,0.067,0],[0.244,0.429,0.068,0.067,0],[0.285,0.429,0.068,0.067,0],[0.326,0.429,0.068,0.067,0],[0.367,0.429,0.068,0.067,0],[0.489,0.429,0.068,0.067,0],[-0.774,0.389,0.068,0.067,0],[-0.733,0.389,0.068,0.067,0],[-0.163,0.389,0.068,0.067,0],[0.122,0.389,0.068,0.067,0],[0.163,0.389,0.068,0.067,0],[0.204,0.389,0.068,0.067,0],[0.244,0.389,0.068,0.067,0],[0.367,0.389,0.068,0.067,0],[0.489,0.389,0.068,0.067,0],[0.57,0.389,0.068,0.067,0],[-0.652,0.348,0.068,0.067,0],[-0.57,0.348,0.068,0.067,0],[-0.326,0.348,0.068,0.067,0],[-0.204,0.348,0.068,0.067,0],[0.082,0.348,0.068,0.067,0],[0.407,0.348,0.068,0.067,0],[0.489,0.348,0.068,0.067,0],[0.611,0.348,0.068,0.067,0],[0.693,0.348,0.068,0.067,0],[0.774,0.348,0.068,0.067,0],[-0.856,0.307,0.068,0.067,0],[-0.652,0.307,0.068,0.067,0],[-0.53,0.307,0.068,0.067,0],[-0.326,0.307,0.068,0.067,0],[-0.204,0.307,0.068,0.067,0],[-0.163,0.307,0.068,0.067,0],[-0.082,0.307,0.068,0.067,0],[0,0.307,0.068,0.067,0],[0.489,0.307,0.068,0.067,0],[0.611,0.307,0.068,0.067,0],[-0.815,0.266,0.068,0.067,0],[-0.489,0.266,0.068,0.067,0],[-0.407,0.266,0.068,0.067,0],[-0.245,0.266,0.068,0.067,0],[0.244,0.266,0.068,0.067,0],[0.448,0.266,0.068,0.067,0],[0.489,0.266,0.068,0.067,0],[0.611,0.266,0.068,0.067,0],[-0.774,0.225,0.068,0.067,0],[-0.611,0.225,0.068,0.067,0],[-0.448,0.225,0.068,0.067,0],[-0.367,0.225,0.068,0.067,0],[-0.326,0.225,0.068,0.067,0],[-0.082,0.225,0.068,0.067,0],[0.489,0.225,0.068,0.067,0],[0.611,0.225,0.068,0.067,0],[0.693,0.225,0.068,0.067,0],[-0.733,0.184,0.068,0.067,0],[-0.122,0.184,0.068,0.067,0],[0.489,0.184,0.068,0.067,0],[0.611,0.184,0.068,0.067,0],[0.733,0.184,0.068,0.067,0],[-0.733,0.143,0.068,0.067,0],[-0.204,0.143,0.068,0.067,0],[0.489,0.143,0.068,0.067,0],[-0.407,0.102,0.068,0.067,0],[-0.367,0.102,0.068,0.067,0],[-0.326,0.102,0.068,0.067,0],[-0.285,0.102,0.068,0.067,0],[0.326,0.102,0.068,0.067,0],[0.489,0.102,0.068,0.067,0],[-0.489,0.061,0.068,0.067,0],[0.326,0.061,0.068,0.067,0],[0.855,0.061,0.068,0.067,0],[-0.57,0.02,0.068,0.067,0],[-0.53,0.02,0.068,0.067,0],[-0.204,0.02,0.068,0.067,0],[0.448,0.02,0.068,0.067,0],[0.53,0.02,0.068,0.067,0],[0.57,0.02,0.068,0.067,0],[0.774,0.02,0.068,0.067,0],[0.53,-0.02,0.068,0.067,0],[0.652,-0.02,0.068,0.067,0],[0.693,-0.02,0.068,0.067,0],[-0.733,-0.061,0.068,0.067,0],[0.326,-0.061,0.068,0.067,0],[0.489,-0.061,0.068,0.067,0],[0,-0.102,0.068,0.067,0],[0.448,-0.102,0.068,0.067,0],[-0.733,-0.143,0.068,0.067,0],[-0.448,-0.143,0.068,0.067,0],[0.041,-0.143,0.068,0.067,0],[0.082,-0.143,0.068,0.067,0],[0.244,-0.143,0.068,0.067,0],[0.407,-0.143,0.068,0.067,0],[-0.774,-0.184,0.068,0.067,0],[-0.733,-0.184,0.068,0.067,0],[-0.448,-0.184,0.068,0.067,0],[0.367,-0.184,0.068,0.067,0],[0.407,-0.184,0.068,0.067,0],[-0.856,-0.225,0.068,0.067,0],[-0.733,-0.225,0.068,0.067,0],[-0.407,-0.225,0.068,0.067,0],[-0.367,-0.225,0.068,0.067,0],[-0.326,-0.225,0.068,0.067,0],[-0.285,-0.225,0.068,0.067,0],[0.285,-0.225,0.068,0.067,0],[0.326,-0.225,0.068,0.067,0],[0.448,-0.225,0.068,0.067,0],[0.244,-0.266,0.068,0.067,0],[0.285,-0.266,0.068,0.067,0],[0.489,-0.266,0.068,0.067,0],[0.53,-0.266,0.068,0.067,0],[-0.733,-0.307,0.068,0.067,0],[-0.367,-0.307,0.068,0.067,0],[0.244,-0.307,0.068,0.067,0],[0.367,-0.307,0.068,0.067,0],[0.407,-0.307,0.068,0.067,0],[0.448,-0.307,0.068,0.067,0],[0.57,-0.307,0.068,0.067,0],[0.774,-0.307,0.068,0.067,0],[-0.815,-0.348,0.068,0.067,0],[-0.774,-0.348,0.068,0.067,0],[-0.693,-0.348,0.068,0.067,0],[0.285,-0.348,0.068,0.067,0],[0.611,-0.348,0.068,0.067,0],[0.693,-0.348,0.068,0.067,0],[0.733,-0.348,0.068,0.067,0],[-0.693,-0.388,0.068,0.067,0],[-0.326,-0.388,0.068,0.067,0],[0.204,-0.388,0.068,0.067,0],[0.693,-0.388,0.068,0.067,0],[-0.652,-0.429,0.068,0.067,0],[-0.611,-0.429,0.068,0.067,0],[-0.326,-0.429,0.068,0.067,0],[-0.285,-0.429,0.068,0.067,0],[0.204,-0.429,0.068,0.067,0],[0.244,-0.429,0.068,0.067,0],[0.693,-0.429,0.068,0.067,0],[-0.652,-0.47,0.068,0.067,0],[-0.57,-0.47,0.068,0.067,0],[-0.53,-0.47,0.068,0.067,0],[-0.326,-0.47,0.068,0.067,0],[0.204,-0.47,0.068,0.067,0],[0.693,-0.47,0.068,0.067,0],[-0.489,-0.511,0.068,0.067,0],[-0.326,-0.511,0.068,0.067,0],[0.163,-0.511,0.068,0.067,0],[-0.489,-0.552,0.068,0.067,0],[-0.245,-0.552,0.068,0.067,0],[0.163,-0.552,0.068,0.067,0],[-0.448,-0.593,0.068,0.067,0],[-0.407,-0.593,0.068,0.067,0],[-0.285,-0.593,0.068,0.067,0],[-0.204,-0.593,0.068,0.067,0],[0.122,-0.593,0.068,0.067,0],[-0.448,-0.634,0.068,0.067,0],[-0.367,-0.634,0.068,0.067,0],[-0.285,-0.634,0.068,0.067,0],[-0.245,-0.634,0.068,0.067,0],[0.041,-0.634,0.068,0.067,0],[0.082,-0.634,0.068,0.067,0],[0.122,-0.634,0.068,0.067,0],[-0.489,-0.675,0.068,0.067,0],[-0.448,-0.675,0.068,0.067,0],[-0.285,-0.675,0.068,0.067,0],[-0.245,-0.675,0.068,0.067,0],[-0.204,-0.675,0.068,0.067,0],[-0.163,-0.675,0.068,0.067,0],[-0.122,-0.675,0.068,0.067,0],[-0.082,-0.675,0.068,0.067,0],[-0.041,-0.675,0.068,0.067,0],[0,-0.675,0.068,0.067,0],[0.082,-0.675,0.068,0.067,0],[0.163,-0.675,0.068,0.067,0],[0.204,-0.675,0.068,0.067,0],[0.244,-0.675,0.068,0.067,0],[0.285,-0.675,0.068,0.067,0],[0.367,-0.675,0.068,0.067,0],[-0.041,-0.716,0.068,0.067,0],[0,-0.716,0.068,0.067,0],[0.041,-0.716,0.068,0.067,0],[0.448,-0.716,0.068,0.067,0],[-0.489,-0.756,0.068,0.067,0],[-0.041,-0.756,0.068,0.067,0],[0,-0.756,0.068,0.067,0],[-0.367,-0.797,0.068,0.067,0],[-0.245,-0.797,0.068,0.067,0],[-0.122,-0.797,0.068,0.067,0],[-0.082,-0.797,0.068,0.067,0],[-0.204,-0.838,0.068,0.067,0],[0,-0.838,0.068,0.067,0],[-0.285,-0.879,0.068,0.067,0],[0,-0.879,0.068,0.067,0]] },
  { fill: "#F5E960", pts: [[-0.082,0.92,0.067,0.067,1],[-0.204,0.838,0.067,0.067,1],[-0.122,0.756,0.067,0.067,1],[0,0.756,0.067,0.067,1],[-0.57,0.716,0.067,0.067,1],[0.245,0.716,0.067,0.067,1],[0.611,0.675,0.067,0.067,1],[0.367,0.634,0.067,0.067,1],[0,0.593,0.067,0.067,1],[0,0.552,0.067,0.067,1],[-0.774,0.511,0.067,0.067,1],[-0.489,0.511,0.067,0.067,1],[-0.285,0.511,0.067,0.067,1],[-0.204,0.511,0.067,0.067,1],[0.041,0.511,0.067,0.067,1],[0.285,0.511,0.067,0.067,1],[-0.611,0.47,0.067,0.067,1],[0.041,0.47,0.067,0.067,1],[0.733,0.47,0.067,0.067,1],[0.53,0.389,0.067,0.067,1],[-0.774,0.348,0.067,0.067,1],[0.652,0.348,0.067,0.067,1],[-0.244,0.307,0.067,0.067,1],[0.041,0.307,0.067,0.067,1],[0.163,0.307,0.067,0.067,1],[0.407,0.307,0.067,0.067,1],[-0.774,0.266,0.067,0.067,1],[-0.326,0.266,0.067,0.067,1],[-0.204,0.266,0.067,0.067,1],[0.204,0.266,0.067,0.067,1],[0.652,0.266,0.067,0.067,1],[-0.285,0.225,0.067,0.067,1],[0.774,0.143,0.067,0.067,1],[-0.733,0.102,0.067,0.067,1],[-0.733,0.061,0.067,0.067,1],[-0.244,0.061,0.067,0.067,1],[0.489,0.061,0.067,0.067,1],[0.53,0.061,0.067,0.067,1],[0.815,0.061,0.067,0.067,1],[0.896,0.061,0.067,0.067,1],[-0.611,0.02,0.067,0.067,1],[-0.489,0.02,0.067,0.067,1],[-0.163,0.02,0.067,0.067,1],[0.367,0.02,0.067,0.067,1],[0.489,0.02,0.067,0.067,1],[-0.611,-0.02,0.067,0.067,1],[-0.122,-0.02,0.067,0.067,1],[0.489,-0.02,0.067,0.067,1],[-0.448,-0.061,0.067,0.067,1],[-0.733,-0.102,0.067,0.067,1],[-0.652,-0.102,0.067,0.067,1],[-0.448,-0.102,0.067,0.067,1],[-0.163,-0.102,0.067,0.067,1],[0.285,-0.102,0.067,0.067,1],[0.896,-0.102,0.067,0.067,1],[0.122,-0.143,0.067,0.067,1],[0.163,-0.143,0.067,0.067,1],[0.856,-0.143,0.067,0.067,1],[0,-0.184,0.067,0.067,1],[0.204,-0.184,0.067,0.067,1],[-0.815,-0.225,0.067,0.067,1],[-0.367,-0.266,0.067,0.067,1],[-0.693,-0.307,0.067,0.067,1],[-0.326,-0.348,0.067,0.067,1],[0.57,-0.348,0.067,0.067,1],[-0.856,-0.388,0.067,0.067,1],[0.245,-0.388,0.067,0.067,1],[0.733,-0.388,0.067,0.067,1],[-0.367,-0.511,0.067,0.067,1],[0.245,-0.511,0.067,0.067,1],[0.693,-0.511,0.067,0.067,1],[-0.407,-0.552,0.067,0.067,1],[0.122,-0.552,0.067,0.067,1],[0.367,-0.552,0.067,0.067,1],[0.122,-0.675,0.067,0.067,1],[0.326,-0.675,0.067,0.067,1],[0.407,-0.675,0.067,0.067,1],[0.489,-0.716,0.067,0.067,1],[-0.53,-0.756,0.067,0.067,1],[-0.326,-0.838,0.067,0.067,1],[-0.163,-0.92,0.067,0.067,1]] }
];

// per-color depth layer (falls back to a spread by paint order for any other SVG)
const Z_LAYER = { '#BD85FF': 0.18, '#F59CF4': -0.18, '#16BAC5': 0.0, '#8D04FD': 0.05, '#F5E960': 0.1 };

// easing set — shader uses the mode index (uEase / uRevealEase); JS mirror drives the 3D rotation unwind so it stays in sync
const EASE_JS = [
  x => x,
  x => 1 - (1 - x) * (1 - x),
  x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  x => 1 - Math.pow(1 - x, 3),
  x => 1 - Math.pow(1 - x, 4),
  x => { const c1 = 1.70158, c3 = c1 + 1, m = x - 1; return 1 + c3 * m * m * m + c1 * m * m; },
  x => { const c4 = (2 * Math.PI) / 3; return x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1; },
];

// default config = Tom's exported preset
const DEFAULTS = {
  fit: 0.92,
  cloud: { radius: 2.9, shell: 0.94 }, start: { dot: 0.02 },
  timeline: { revealDur: 1.8, hold: 0.35, assembleDur: 2.8, revWindow: 0.19, asmWindow: 0.34, asmOrder: 'radial', easeMode: 2, revealEaseMode: 2 },
  flow: { arc: 2.0, scale: 0.2 }, spin: { speed: 0.4, tilt: 0.4 },
  depth: { fog: 0.0, near: 0.5, far: 5.1 }, cloudDrift: 0.6, idleDrift: 0.063,
  merge: { amount: 1.0, speed: 0.5, dist: 0.07 }, warp: { amount: 0.0, freq: 30.0, speed: 1.65 },
  bg: '#160e2e',
  resolveAt: 0.78, // fire the "shapefield:resolved" event when assemble is this far along (shapes formed)
};
function deepMerge(a, b) {
  const o = Array.isArray(a) ? a.slice() : { ...a };
  for (const k in (b || {})) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) ? deepMerge(o[k] || {}, b[k]) : b[k];
  return o;
}

class ShapeField {
  constructor(mount, overrides = {}) {
    this.mount = mount; this.config = deepMerge(DEFAULTS, overrides);
    this.MAX = 6000; this._t0 = 0; this._spin = 0; this._lastT = 0; this._raf = 0; this._visible = true; this._resolved = false; this._started = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(0x000000, 0);
    mount.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); this.camera.position.set(0, 0, 3.6);
    this._buildMesh(); this.rebuild(); this._resize();
    this._onResize = () => this._resize(); addEventListener('resize', this._onResize);
    this._clock = new THREE.Clock();
    // pause the render loop while the hero is scrolled out of view
    this._io = new IntersectionObserver((e) => { this._visible = e[0].isIntersecting; }, { threshold: 0 });
    this._io.observe(mount);
    this._loop = this._loop.bind(this); this._raf = requestAnimationFrame(this._loop);
  }
  _resize() {
    const r = this.mount.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _buildMesh() {
    const quad = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
    const f = (n) => new THREE.InstancedBufferAttribute(new Float32Array(this.MAX * n), n);
    this.aFinal = f(3); this.aStart = f(3); this.aSize = f(2); this.aColor = f(3); this.aShape = f(1);
    this.aSeed = f(1); this.aDelay = f(1); this.aGridDelay = f(1); this.aNbr = f(2);
    for (const [k, v] of Object.entries({ aFinal: this.aFinal, aStart: this.aStart, aSize: this.aSize, aColor: this.aColor, aShape: this.aShape, aSeed: this.aSeed, aDelay: this.aDelay, aGridDelay: this.aGridDelay, aNbr: this.aNbr })) geo.setAttribute(k, v);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uReveal: { value: 1 }, uAssemble: { value: 1 }, uRevWindow: { value: 0.5 }, uAsmWindow: { value: 1.0 }, uStartDot: { value: 0.05 },
        uEase: { value: 2 }, uRevealEase: { value: 2 },
        uArc: { value: 0.5 }, uFlowScale: { value: 1.2 }, uCloudDrift: { value: 0.165 }, uIdle: { value: 0.006 },
        uMerge: { value: 1.0 }, uMergeSpeed: { value: 1.4 }, uWarpAmp: { value: 0.02 }, uWarpFreq: { value: 12.0 }, uWarpSpeed: { value: 1.0 },
        uNear: { value: 2.2 }, uFar: { value: 5.2 }, uFog: { value: 0.0 }, uBg: { value: new THREE.Color(this.config.bg) },
      },
      vertexShader: `
        attribute vec3 aFinal; attribute vec3 aStart; attribute vec2 aSize; attribute vec3 aColor; attribute float aShape; attribute float aSeed; attribute float aDelay; attribute float aGridDelay; attribute vec2 aNbr;
        uniform float uTime,uReveal,uAssemble,uRevWindow,uAsmWindow,uStartDot,uArc,uFlowScale,uCloudDrift,uIdle,uMerge,uMergeSpeed,uEase,uRevealEase;
        varying vec2 vUv; varying vec3 vColor; varying float vShape; varying float vAlpha; varying float vRound; varying float vSeed; varying float vDepth;
        float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
        float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y), mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y), f.z); }
        vec3 noise3(vec3 p){ return vec3(vnoise(p), vnoise(p+19.0), vnoise(p+41.0)) - 0.5; }
        float applyEase(float x, float m){ x=clamp(x,0.0,1.0);
          if(m<0.5) return x;
          if(m<1.5) return 1.0-(1.0-x)*(1.0-x);
          if(m<2.5) return x<0.5?4.0*x*x*x:1.0-pow(-2.0*x+2.0,3.0)/2.0;
          if(m<3.5) return 1.0-pow(1.0-x,3.0);
          if(m<4.5) return 1.0-pow(1.0-x,4.0);
          if(m<5.5){ float c1=1.70158,c3=c1+1.0,xm=x-1.0; return 1.0+c3*xm*xm*xm+c1*xm*xm; }
          float c4=6.2831853/3.0; return x<=0.0?0.0:(x>=1.0?1.0:pow(2.0,-10.0*x)*sin((x*10.0-0.75)*c4)+1.0); }
        void main(){
          vColor=aColor; vShape=aShape; vSeed=aSeed;
          float prRaw = clamp((uReveal - aGridDelay*(1.0-uRevWindow))/max(uRevWindow,0.001),0.0,1.0);
          float pr = applyEase(prRaw, uRevealEase);
          float paRaw = clamp((uAssemble - aDelay*(1.0-uAsmWindow))/max(uAsmWindow,0.001),0.0,1.0);
          float pa = applyEase(paRaw, uEase);
          float e = pa;
          vec3 base = mix(aStart, aFinal, e);
          float bell = sin(pa*3.14159);
          vec3 arc = noise3(aStart*uFlowScale + aSeed*3.0 + vec3(0.0,0.0,uTime*0.1))*uArc*bell;
          vec3 drift = noise3(aFinal*1.4 + aSeed*7.0 + vec3(uTime*0.25))*mix(uCloudDrift,uIdle,e);
          vec3 center = base + arc + drift;
          float osc = 0.5+0.5*sin(uTime*uMergeSpeed + aSeed*6.2831);
          center.xy += aNbr*uMerge*osc*e;
          vec2 sz = mix(vec2(uStartDot), aSize, e);
          float roundEnd = (aShape<0.5)?1.0:0.18; vRound = mix(1.0, roundEnd, e);
          vUv = uv-0.5;
          vec4 mv = modelViewMatrix*vec4(center,1.0); vDepth=-mv.z;
          mv.xy += (uv-0.5)*sz*pr;
          gl_Position = projectionMatrix*mv; vAlpha = pr;
        }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv; varying vec3 vColor; varying float vShape; varying float vAlpha; varying float vRound; varying float vSeed; varying float vDepth;
        uniform float uTime,uWarpAmp,uWarpFreq,uWarpSpeed,uNear,uFar,uFog; uniform vec3 uBg;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y); }
        float sdRoundBox(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0)-r; }
        void main(){
          vec2 p = vUv;
          vec2 w = vec2(noise(p*uWarpFreq+vSeed*17.0+uTime*uWarpSpeed), noise(p*uWarpFreq+vSeed*17.0+31.0-uTime*uWarpSpeed))-0.5; p += w*uWarpAmp;
          float r = 0.5*vRound; float d = sdRoundBox(p, vec2(0.5)-r, r);
          float aa = fwidth(d); float alpha = (1.0-smoothstep(-aa,aa,d))*vAlpha;
          float fog = clamp((uFar-vDepth)/max(uFar-uNear,0.01),0.0,1.0);
          vec3 col = mix(uBg, vColor, mix(1.0-uFog,1.0,fog)); alpha *= mix(1.0-uFog*0.6,1.0,fog);
          if(alpha<0.01) discard; gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.geo = geo; this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.scene.add(this.mesh);
  }
  rebuild() {
    const c = this.config, fit = c.fit, frac = (n) => { const h = Math.sin(n * 78.233) * 43758.5453; return h - Math.floor(h); };
    const R = c.cloud.radius, shell = c.cloud.shell; this.mat.uniforms.uStartDot.value = c.start.dot;
    let i = 0;
    SHAPES.forEach((L, li) => {
      const rgb = new THREE.Color(L.fill), z = Z_LAYER[L.fill.toUpperCase()] ?? (li / Math.max(1, SHAPES.length - 1) - 0.5) * 0.4;
      for (const s of L.pts) {
        if (i >= this.MAX) break;
        const x = s[0], y = s[1], sw = s[2], sh = s[3], sq = s[4];
        this.aFinal.array[i*3]=x; this.aFinal.array[i*3+1]=y; this.aFinal.array[i*3+2]=z;
        this.aSize.array[i*2]=sw; this.aSize.array[i*2+1]=sh;
        this.aColor.array[i*3]=rgb.r; this.aColor.array[i*3+1]=rgb.g; this.aColor.array[i*3+2]=rgb.b;
        this.aShape.array[i]=sq; this.aSeed.array[i]=frac(i+1);
        const u = frac(i*1.7)*2-1, th = frac(i*3.31)*Math.PI*2, sr = Math.sqrt(1-u*u), rad = R*(shell+(1-shell)*Math.cbrt(frac(i*5.13)));
        this.aStart.array[i*3]=sr*Math.cos(th)*rad; this.aStart.array[i*3+1]=sr*Math.sin(th)*rad; this.aStart.array[i*3+2]=u*rad;
        this.aGridDelay.array[i]=frac(i+1);
        const rr = Math.min(1, Math.hypot(x, y)/fit);
        this.aDelay.array[i]= c.timeline.asmOrder==='radial'?rr:(c.timeline.asmOrder==='random'?frac(i+2):(u*0.5+0.5));
        i++;
      }
    });
    this.active = i;
    const md2 = c.merge.dist**2, F=this.aFinal.array, CO=this.aColor.array, NB=this.aNbr.array;
    for (let a=0;a<i;a++){ const ax=F[a*3], ay=F[a*3+1], cr=CO[a*3], cg=CO[a*3+1], cb=CO[a*3+2]; let bx=0,by=0,bd=1e9;
      for (let b=0;b<i;b++){ if(b===a||Math.abs(CO[b*3]-cr)>0.01||Math.abs(CO[b*3+1]-cg)>0.01||Math.abs(CO[b*3+2]-cb)>0.01) continue; const dx=F[b*3]-ax,dy=F[b*3+1]-ay,dd=dx*dx+dy*dy; if(dd<bd){bd=dd;bx=dx;by=dy;} }
      const ok = bd<=md2; NB[a*2]=ok?bx:0; NB[a*2+1]=ok?by:0; }
    [this.aFinal,this.aStart,this.aSize,this.aColor,this.aShape,this.aSeed,this.aDelay,this.aGridDelay,this.aNbr].forEach(a=>a.needsUpdate=true);
    this.geo.instanceCount = i;
  }
  replay() { this._t0 = this._clock ? this._clock.getElapsedTime() : 0; this._spin = 0; this.mesh.rotation.set(0,0,0); }
  destroy() { cancelAnimationFrame(this._raf); removeEventListener('resize', this._onResize); this._io && this._io.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); }
  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const now = this._clock.getElapsedTime();
    // Parked (offscreen / tab not compositing): FREEZE the timeline — remember when we paused.
    if (!this._visible) { if (this._parkedAt == null) this._parkedAt = now; this._lastT = now; return; }
    // Resuming: shift the anchor forward by however long we were parked, so `te` continues where it
    // left off instead of jumping ahead (which would snap the swarm + resolve event to the end).
    if (this._parkedAt != null) { this._t0 += now - this._parkedAt; this._parkedAt = null; this._lastT = now; }
    // Anchor the timeline to the FIRST frame that actually renders — not construction time.
    if (!this._started) { this._started = true; this._t0 = now; this._lastT = now; }
    const t = now, dt = Math.min(0.05, t - this._lastT); this._lastT = t;
    const c = this.config, u = this.mat.uniforms; u.uTime.value = t;
    const te = this.reduced ? 1e6 : (t - this._t0), tl = c.timeline;
    const rev = Math.min(1, te/Math.max(0.01,tl.revealDur));
    const asm = Math.min(1, Math.max(0, (te-tl.revealDur-tl.hold)/Math.max(0.01,tl.assembleDur)));
    if (!this._resolved && asm >= (c.resolveAt ?? 0.78)) { // shapes have formed → let the hero content reveal
      this._resolved = true;
      (window.__shapefieldResolved || (window.__shapefieldResolved = new Set())).add('shapefield:resolved');
      document.dispatchEvent(new CustomEvent('shapefield:resolved', { detail: { field: this } }));
    }
    u.uReveal.value=rev; u.uAssemble.value=asm; u.uRevWindow.value=tl.revWindow; u.uAsmWindow.value=tl.asmWindow;
    u.uEase.value=tl.easeMode; u.uRevealEase.value=tl.revealEaseMode;
    u.uArc.value=c.flow.arc; u.uFlowScale.value=c.flow.scale; u.uCloudDrift.value=c.cloudDrift; u.uIdle.value=c.idleDrift;
    u.uMerge.value=c.merge.amount; u.uMergeSpeed.value=c.merge.speed; u.uWarpAmp.value=c.warp.amount; u.uWarpFreq.value=c.warp.freq; u.uWarpSpeed.value=c.warp.speed;
    u.uNear.value=c.depth.near; u.uFar.value=c.depth.far; u.uFog.value=c.depth.fog;
    const eAsm = (EASE_JS[c.timeline.easeMode] || EASE_JS[2])(asm);
    if (asm<0.995) this._spin += dt*c.spin.speed;
    const unwind = 1-eAsm;
    this.mesh.rotation.y = this._spin*unwind; this.mesh.rotation.x = c.spin.tilt*unwind*(0.4+0.6*Math.sin(t*0.3));
    this.renderer.render(this.scene, this.camera);
  }
}

export { ShapeField, DEFAULTS, SHAPES };
export default ShapeField;
