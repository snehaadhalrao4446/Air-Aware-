import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Wind,
  MapPin,
  Activity,
  Droplets,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import "./App.css";

const locations = {
  Pune: { aqi: 74, pm25: 22, pm10: 41, status: "Moderate" },
  Mumbai: { aqi: 112, pm25: 38, pm10: 67, status: "Moderate" },
  Nashik: { aqi: 48, pm25: 14, pm10: 29, status: "Good" },
  Nagpur: { aqi: 89, pm25: 27, pm10: 52, status: "Moderate" },
  "Chhatrapati Sambhajinagar": {
    aqi: 61, pm25: 18, pm10: 35, status: "Satisfactory"
  },
};

const API_BASE_URL = "/api";

export default function App() {
  const [city, setCity] = useState("Pune");
  const [readings, setReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(true);
  const [readingsError, setReadingsError] = useState("");
  const [timeRange, setTimeRange] = useState("24 Hours");
  const [apiData, setApiData] = useState({});
  useEffect(() => {
    let cancelled = false;

    async function fetchAirQuality() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/summary?location=${encodeURIComponent(city)}`
        );

        if (!response.ok) {
          throw new Error(`API request failed (${response.status})`);
        }

        const result = await response.json();

        if (!cancelled) {
          const averages = result.averages;

          setApiData((previous) => ({
            ...previous,
            [city]: {
              aqi: Math.round(averages.us_aqi),
              pm25: Number(averages.pm2_5.toFixed(2)),
              pm10: Number(averages.pm10.toFixed(2)),
              status:
                averages.us_aqi <= 50 ? "Good" :
                averages.us_aqi <= 100 ? "Moderate" :
                averages.us_aqi <= 150 ? "Unhealthy for Sensitive Groups" :
                averages.us_aqi <= 200 ? "Unhealthy" :
                averages.us_aqi <= 300 ? "Very Unhealthy" :
                "Hazardous",
            },
          }));
        }
      } 
      catch (error) {
        if (!cancelled) {
          console.error("Could not fetch air quality summary:", error);
        }
      }
    }

    fetchAirQuality();

    return () => {
      cancelled = true;
    };
  }, [city]);
  
  useEffect(() => {
    let cancelled = false;

    async function fetchReadings() {
      setReadingsLoading(true);
      setReadingsError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/readings?location=${encodeURIComponent(city)}`
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const result = await response.json();
        if (!Array.isArray(result)) {
          throw new Error("The readings API returned an invalid response.");
        }

        if (!cancelled) {
          setReadings(result);
        }
      } catch (error) {
        if (!cancelled) {
          setReadings([]);
          setReadingsError(
            error instanceof Error ? error.message : "Unknown API error"
          );
          console.error("Could not fetch historical readings:", error);
        }
      } finally {
        if (!cancelled) {
          setReadingsLoading(false);
        }
      }
    }

    fetchReadings();

    return () => {
      cancelled = true;
    };
  }, [city]);

  const data = apiData[city] || locations[city];
  const sortedReadings = readings
    .slice()
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  const chartData = timeRange === "24 Hours"
    ? sortedReadings.slice(-24).map((reading) => ({
        time: new Date(reading.time).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        aqi: Number(reading.us_aqi),
      }))
    : (() => {
        const dayCount = timeRange === "7 Days" ? 7 : 30;
        const availableDays = [...new Set(
          sortedReadings.map((reading) => String(reading.time).slice(0, 10))
        )];
        const visibleDays = new Set(availableDays.slice(-dayCount));
        const readingsByDay = new Map();

        sortedReadings.forEach((reading) => {
          const day = String(reading.time).slice(0, 10);
          const aqi = Number(reading.us_aqi);
          if (!visibleDays.has(day) || !Number.isFinite(aqi)) return;

          const dayReadings = readingsByDay.get(day) || [];
          dayReadings.push(aqi);
          readingsByDay.set(day, dayReadings);
        });

        return [...readingsByDay.entries()].map(([day, values]) => ({
          time: new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),
          aqi: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
        }));
      })();
  
  const gaugeColor =
    data.aqi <= 50 ? "#16a34a" :
    data.aqi <= 100 ? "#eab308" :
    data.aqi <= 200 ? "#f97316" :
    "#dc2626";

  const gaugeAngle = Math.min(data.aqi, 300) / 300 * 180;


  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Wind size={23} /></div>
          <div>
            <h2>AirAware</h2>
            <span>HYPERLOCAL AIR QUALITY</span>
          </div>
        </div>
        <div className="live-label"><span /> Demo dashboard</div>
      </header>

      <main className="main-content">
        <section className="welcome">
          <div>
            <p className="eyebrow">YOUR ENVIRONMENT, AT A GLANCE</p>
            <h1>Breathe smarter.</h1>
            <p className="subtitle">
              Understand the air around you and make healthier everyday choices.
            </p>
          </div>
          <label className="location-select">
            <MapPin size={19} />
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {Object.keys(locations).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="aqi-banner">
          <div>
            <p className="eyebrow">CURRENT AIR QUALITY INDEX</p>
            <div className="aqi-number">{data.aqi}</div>
            <h3>{data.status}</h3>
            <p className="banner-note">
              {data.aqi <= 50
                ? "Air quality is good. Enjoy outdoor activities."
                : data.aqi <= 100
                ? "Air quality is acceptable for most people."
                : "Sensitive individuals should limit prolonged outdoor activity."}
            </p>
          </div>
          
<div className="aqi-graphic">
  <div className="aqi-gauge">
    <svg viewBox="0 0 220 130" className="gauge-svg">
      <path
        d="M 25 110 A 85 85 0 0 1 195 110"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M 25 110 A 85 85 0 0 1 195 110"
        fill="none"
        stroke={gaugeColor}
        strokeWidth="16"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${gaugeAngle / 180 * 100} 100`}
        style={{
          transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease",
        }}
      />
      <text
        x="110"
        y="87"
        textAnchor="middle"
        className="gauge-value"
      >
        {data.aqi}
      </text>
      <text
        x="110"
        y="108"
        textAnchor="middle"
        className="gauge-label"
      >
        AQI
      </text>
    </svg>
    <div className="gauge-caption">
      <span>Good</span>
      <span>Hazardous</span>
    </div>
  </div>
</div>

        </section>

        <section className="section-heading">
          <div>
            <h2>Pollutant overview</h2>
            <p>Key measurements for {city}</p>
          </div>
          <span className="sample-tag"><RefreshCw size={13} /> Sample data</span>
        </section>

        <section className="metric-grid">
          <article className="metric-card">
            <div className="metric-top">
              <span>PM2.5</span>
              <div className="metric-icon"><Activity size={19} /></div>
            </div>
            <div className="metric-value">{data.pm25}<small> µg/m³</small></div>
            <p>Fine particulate matter</p>
          </article>
          <article className="metric-card">
            <div className="metric-top">
              <span>PM10</span>
              <div className="metric-icon"><Wind size={19} /></div>
            </div>
            <div className="metric-value">{data.pm10}<small> µg/m³</small></div>
            <p>Coarse particulate matter</p>
          </article>
          <article className="metric-card">
            <div className="metric-top">
              <span>Air quality</span>
              <div className="metric-icon"><Droplets size={19} /></div>
            </div>
            <div className="metric-value status-value">{data.status}</div>
            <p>Based on the displayed AQI</p>
          </article>
        </section>

        <section className="section-heading chart-heading">
          <div>
            <h2>Air quality throughout the day</h2>
            <p>Historical AQI readings for {city}</p>
          </div>
        </section>

        <section className="chart-card">
          <div className="chart-toolbar">
  <div className="chart-legend"><span /> AQI trend</div>
  <div className="range-buttons">
  {["24 Hours", "7 Days", "30 Days"].map((range) => (
    <button
      key={range}
      className={timeRange === range ? "range-btn active" : "range-btn"}
      onClick={() => setTimeRange(range)}
    >
      {range}
    </button>
  ))}
</div>
</div>
         <div className="chart-container">
            {readingsLoading ? (
              <p className="chart-message" role="status">Loading air quality history…</p>
            ) : readingsError ? (
              <p className="chart-message" role="alert">
                Could not load chart data ({readingsError}). Start the API with{" "}
                <code>python -m uvicorn backend:app --reload</code> from the project folder.
              </p>
            ) : chartData.length === 0 ? (
              <p className="chart-message" role="status">
                No air quality readings are available for {city} in this time range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#24402e" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#8ba894" tick={{ fill: "#edf7ef", fontSize: 12 }} />
                  <YAxis stroke="#8ba894" tick={{ fill: "#edf7ef", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#101713", borderColor: "#28613b", color: "#fff" }}
                    labelStyle={{ color: "#d5f0dc" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="aqi"
                    stroke="#38d46a"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#38d46a", stroke: "#050806" }}
                    activeDot={{ r: 7, fill: "#7bf09a", stroke: "#050806" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

       
<section className="map-section">
  <div className="section-heading">
    <div>
      <h2>Explore local air quality</h2>
      <p>Click a city marker to view its AQI readings.</p>
    </div>
  </div>

  <div className="interactive-map">
    <MapContainer
      center={[19.2, 75.7]}
      zoom={6}
      scrollWheelZoom={true}
      style={{ height: "420px", width: "100%", borderRadius: "16px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {[
        { name: "Pune", position: [18.5204, 73.8567] },
        { name: "Mumbai", position: [19.076, 72.8777] },
        { name: "Nashik", position: [19.9975, 73.7898] },
        { name: "Nagpur", position: [21.1458, 79.0882] },
        {
          name: "Chhatrapati Sambhajinagar",
          position: [19.8762, 75.3433],
        },
      ].map((place) => {
        const aqi = locations[place.name].aqi;
        const color =
          aqi <= 50 ? "#16a34a" :
          aqi <= 100 ? "#eab308" :
          aqi <= 200 ? "#f97316" :
          "#dc2626";

        return (
          <CircleMarker
            key={place.name}
            center={place.position}
            radius={11}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => setCity(place.name),
            }}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              AQI: {aqi}
              <br />
              {aqi <= 50
                ? "Good"
                : aqi <= 100
                ? "Moderate"
                : aqi <= 200
                ? "Poor"
                : "Very Poor"}
              <br />
              Click the marker to update the dashboard.
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  </div>
</section>
    <footer>AirAware · Hyperlocal Air Quality Insights · Portfolio demo</footer>
      </main>
    </div>
  );
}
