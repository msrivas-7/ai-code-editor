function once(fn) {
  let hasRun = false;
  let result;
  return () => {
    if (!hasRun) {
      result = fn();
      hasRun = true;
    }
    return result;
  };
}
