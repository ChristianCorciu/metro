const request = require('supertest');

// Define the mock object that the Pool constructor will return
const mockPool = {
  query: jest.fn(),
  on: jest.fn(),
  end: jest.fn()
};

// Mock the 'pg' module. The factory function returns an object
// with a 'Pool' property. When new Pool() is called, it returns our mockPool.
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => mockPool)
  };
});

// Now that the mock is configured, require the app
const app = require('../server');

describe('API Integration Tests', () => {
  let server;

  beforeAll((done) => {
    process.env.NODE_ENV = 'test';
    server = app.listen(5002, '0.0.0.0', () => done());
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    }
  });

  beforeEach(() => {
    // Clear all mock history before each test
    jest.clearAllMocks();
    // Use fake timers to control Date object
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterEach(() => {
    // Restore real timers after each test
    jest.useRealTimers();
  });

  describe('Last Metro Tests', () => {
    test('200 - Known station', async () => {
      const mockStation = {
        station: 'République',
        line: 'M3',
        service_end: '01:15'
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockStation] });

      const res = await request(app)
        .get('/last-metro')
        .query({ station: 'République' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        station: mockStation.station,
        line: mockStation.line,
        lastDeparture: mockStation.service_end,
        tz: 'Europe/Paris'
      });
    });

    test('404 - Unknown station', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/last-metro')
        .query({ station: 'Inconnue' });

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'station not found' });
    });

    test('500 - Database error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app)
        .get('/last-metro')
        .query({ station: 'République' });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'internal error' });
    });
  });

  describe('Next Metro Tests', () => {
    test('200 - Known station (service open)', async () => {
      const mockStation = {
        station: 'République',
        line: 'M3',
        headway_min: 4,
        service_start: '05:30',
        service_end: '01:15',
        last_window_start: '00:45'
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockStation] });

      const res = await request(app)
        .get('/next-metro')
        .query({ station: 'République' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        station: mockStation.station,
        line: mockStation.line,
        headwayMin: mockStation.headway_min,
        tz: 'Europe/Paris'
      });
      expect(typeof res.body.nextArrival).toBe('string');
      expect(typeof res.body.isLast).toBe('boolean');
    });

    test('200 - Known station (service closed)', async () => {
      const mockStation = {
        station: 'République',
        line: 'M3',
        service_start: '05:30',
        service_end: '01:15'
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockStation] });

      // Set time to 3 AM (service closed)
      jest.setSystemTime(new Date('2023-01-01T03:00:00Z'));

      const res = await request(app)
        .get('/next-metro')
        .query({ station: 'République' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ service: 'closed', tz: 'Europe/Paris' });
    });

    test('404 - Unknown station', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/next-metro')
        .query({ station: 'Inconnue' });

      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'station not found' });
    });

    test('500 - Database error', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app)
        .get('/next-metro')
        .query({ station: 'République' });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'internal error' });
    });
  });

  describe('Health Check Tests', () => {
    test('200 - API health', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    test('404 - Invalid route', async () => {
      const res = await request(app).get('/invalid-route');
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'not found' });
    });
  });
});