// Polyfills for web compatibility
if (typeof window !== 'undefined') {
  // Mock require function for React Navigation
  window.require = function(module) {
    if (module === '@react-native-community/hooks') {
      return {
        useDimensions: () => ({
          window: { width: window.innerWidth, height: window.innerHeight },
          screen: { width: window.innerWidth, height: window.innerHeight }
        })
      };
    }
    return {};
  };
}