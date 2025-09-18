CREATE TABLE IF NOT EXISTS stations (
id SERIAL PRIMARY KEY,
station TEXT UNIQUE NOT NULL,
line TEXT NOT NULL DEFAULT 'M1',
headway_min INT NOT NULL DEFAULT 3,
service_start TEXT NOT NULL DEFAULT '05:30',
service_end TEXT NOT NULL DEFAULT '01:15',
last_window_start TEXT NOT NULL DEFAULT '00:45'
);


INSERT INTO stations (station, line, headway_min) VALUES
('Chatelet', 'M1', 3)
ON CONFLICT (station) DO NOTHING;