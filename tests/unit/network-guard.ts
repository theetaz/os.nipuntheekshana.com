// Unit tests must explicitly mock GitHub; network availability cannot decide a result.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (/^https?:\/\/(?:api\.)?github\.com(?:\/|$)/i.test(url)) {
    throw new Error('Unit tests must mock GitHub requests.');
  }
  return nativeFetch(input, init);
};
