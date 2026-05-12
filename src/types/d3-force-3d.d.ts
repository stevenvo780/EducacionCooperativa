declare module 'd3-force-3d' {
  export interface ForceLink {
    distance(d: number): this;
    strength(s: number): this;
    iterations(n: number): this;
  }
  export interface ForceManyBody {
    strength(s: number): this;
    theta(t: number): this;
    distanceMax(d: number): this;
  }
  export interface ForceCollide {
    strength(s: number): this;
    iterations(n: number): this;
  }
  export interface ForceCenter {
    strength(s: number): this;
  }
  export function forceLink(): ForceLink;
  export function forceManyBody(): ForceManyBody;
  export function forceCollide(radius: number): ForceCollide;
  export function forceCenter(x: number, y: number): ForceCenter;
}
