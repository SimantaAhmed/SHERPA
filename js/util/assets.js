// Model URLs. Vite serves js/public at the site root, and BASE_URL keeps
// the path right when the build is hosted under a subpath like /SHERPA/.
export function asset(name) {
  return `${import.meta.env.BASE_URL}${name}`;
}
