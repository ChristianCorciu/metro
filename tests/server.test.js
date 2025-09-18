const request = require('supertest');
jest.mock('pg', () => {
const mClient = { query: jest.fn() };
return { Pool: function() { return mClient; } };
});
const pool = require('pg').Pool();
const app = require('../server');


describe('API basic', () => {
afterEach(() => jest.clearAllMocks());


test('/health', async () => {
const res = await request(app).get('/health');
expect(res.statusCode).toBe(200);
expect(res.body).toEqual({ status: 'ok' });
});


test('/next-metro missing station -> 400', async () => {
const res = await request(app).get('/next-metro');
expect(res.statusCode).toBe(400);
expect(res.body).toEqual({ error: 'missing station' });
});


test('/next-metro station not found -> 404', async () => {
pool.query.mockResolvedValue({ rows: [] });
const res = await request(app).get('/next-metro').query({ station: 'Nope' });
expect(res.statusCode).toBe(404);
expect(res.body).toEqual({ error: 'station not found' });
});


test('/next-metro ok -> 200', async () => {
pool.query.mockResolvedValue({ rows: [{ station: 'Chatelet', line: 'M1', headway_min: 3, service_start: '05:30', service_end: '01:15', last_window_start: '00:45' }] });
const res = await request(app).get('/next-metro').query({ station: 'Chatelet' });
expect(res.statusCode).toBe(200);
expect(res.body).toMatchObject({ station: 'Chatelet', line: 'M1', headwayMin: 3, tz: 'Europe/Paris' });
expect(typeof res.body.nextArrival).toBe('string');
expect(typeof res.body.isLast).toBe('boolean');
});
});