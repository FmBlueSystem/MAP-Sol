// Jest setup file
// Mock Electron API
global.electronAPI = {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn()
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};
global.localStorage = localStorageMock;

// Mock Audio
global.Audio = jest.fn(() => ({
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    volume: 1,
    currentTime: 0,
    duration: 0
}));

// Mock Howler
global.Howl = jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    volume: jest.fn(),
    seek: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    unload: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

// Mock AudioContext
global.AudioContext = jest.fn(() => ({
    createMediaElementSource: jest.fn(),
    createAnalyser: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        fftSize: 2048,
        frequencyBinCount: 1024,
        getByteTimeDomainData: jest.fn(),
        getByteFrequencyData: jest.fn()
    })),
    createGain: jest.fn(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        gain: { value: 1 }
    })),
    destination: {},
    state: 'running',
    resume: jest.fn(() => Promise.resolve())
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));
