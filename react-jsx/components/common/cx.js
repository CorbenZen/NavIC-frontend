/** Join truthy class names without introducing a dependency. */
export function cx(...values) {
  return values.filter(Boolean).join(' ');
}
