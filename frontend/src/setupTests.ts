import '@testing-library/jest-dom';

// jsdom non implementa gli object URL: stub minimo per i componenti che li usano
// (es. l'editor di crop delle foto).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
