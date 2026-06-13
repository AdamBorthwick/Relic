// STUB — inline Carbon icon (vendored SVGs, recolor via currentColor).
const { useRef: useIconRef, useEffect: useIconEffect } = React;
function Icon({ name, size, style, className }) {
  const ref = useIconRef(null);
  useIconEffect(() => {
    const el = ref.current;
    if (!el || !window.CarbonIcons) return;
    el.__cdsDone = false; el.setAttribute('data-icon', name); window.CarbonIcons.stamp(el);
  }, [name]);
  return <span ref={ref} className={'cds-icon' + (size ? ' cds-icon--' + size : '') + (className ? ' ' + className : '')} data-icon={name} style={style}></span>;
}
window.Icon = Icon;
