export function applyTheme(theme) {
  document.documentElement.dataset.whmTheme = theme;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--ui-background').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}
