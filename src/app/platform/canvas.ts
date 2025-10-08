export function resolveCanvasElement(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Canvas element with id "${id}" not found`);
  }
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Element with id "${id}" is not a canvas`);
  }
  return element;
}

export function fitCanvasToDisplay(canvas: HTMLCanvasElement): void {
  const resize = () => {
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    const scale = Math.min(width / canvas.width, height / canvas.height);
    canvas.style.transformOrigin = 'top left';
    canvas.style.transform = `scale(${scale})`;
  };

  window.addEventListener('resize', resize);
  resize();
}
