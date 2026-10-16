// Resolves a model file name to a URL that works both in dev and in a build
// deployed under a subpath (GitHub Pages serves this repo from /SHERPA/).
// The .glb files live in js/public, which Vite serves at the site root.
export function asset(name) {
  return `${import.meta.env.BASE_URL}${name}`;
}
