// Configuration globale pour Jest
jest.setTimeout(10000);

// Si vous avez besoin de nettoyer après chaque test
afterEach(() => {
  jest.clearAllMocks();
});