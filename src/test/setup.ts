import '@testing-library/jest-dom/vitest'

// jsdom não implementa ResizeObserver (usado pela lista de mensagens).
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub
}

// jsdom não implementa scrollTo em elementos.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {}
}
