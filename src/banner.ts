/**
 * bitgit CLI banner
 */

// Colors: cyan for "bit", orange/yellow for "git", dim for tagline
const C = '\x1b[36m';  // cyan
const G = '\x1b[33m';  // yellow
const D = '\x1b[90m';  // dim
const W = '\x1b[97m';  // bright white
const R = '\x1b[0m';   // reset

export function showBanner(): void {
  console.log(`
${C}  ██████╗  ██╗████████╗${R}${G}  ██████╗ ██╗████████╗${R}
${C}  ██╔══██╗ ██║╚══██╔══╝${R}${G} ██╔════╝ ██║╚══██╔══╝${R}
${C}  ██████╔╝ ██║   ██║${R}   ${G} ██║  ███╗██║   ██║${R}
${C}  ██╔══██╗ ██║   ██║${R}   ${G} ██║   ██║██║   ██║${R}
${C}  ██████╔╝ ██║   ██║${R}   ${G} ╚██████╔╝██║   ██║${R}
${C}  ╚═════╝  ╚═╝   ╚═╝${R}   ${G}  ╚═════╝ ╚═╝   ╚═╝${R}

${D}  git push for Bitcoin${R}  ${W}v${process.env.npm_package_version || '0.1'}${R}
`);
}
