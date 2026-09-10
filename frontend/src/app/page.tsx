"use client";

import { useEffect, useMemo, useState } from "react";

type SectionKey = "overview" | "predict" | "forecast" | "history" | "visualize";

type PredictionResponse = {
  risk: string;
  anomaly: string;
  estimated_h2s?: number;
  explanation: Record<string, number>;
  shap_explanation?: {
    base_value: number;
    features: Array<{ name: string; value: number }>;
  };
};

type ForecastResponse = {
  predicted_methane: number;
  predicted_air_quality: number;
  predicted_temperature: number;
  predicted_humidity: number;
  predicted_h2s: number;
};

type HistoryItem = {
  ID: number;
  Methane: number;
  "Air Quality": number;
  Temperature: number;
  Humidity: number;
  Risk: string;
  Anomaly: string;
  "Estimated H2S"?: number | null;
};

type SensorForm = {
  methane: number;
  air_quality: number;
  temperature: number;
  humidity: number;
};

const navigation: Array<{ id: SectionKey; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "System snapshot" },
  { id: "predict", label: "Predict", description: "Run hazard analysis" },
  { id: "forecast", label: "Forecast", description: "View next readings" },
  { id: "history", label: "History", description: "Review past predictions" },
  { id: "visualize", label: "Visualize Results", description: "Explore live plots" },
];

const initialForm: SensorForm = {
  methane: 500,
  air_quality: 100,
  temperature: 25,
  humidity: 50,
};

function formatValue(value: number | string, suffix = "") {
  if (typeof value === "number") {
    return `${value.toFixed(1)}${suffix}`;
  }
  return `${value}${suffix}`;
}

function getRiskTone(risk: string) {
  const normalized = risk.toLowerCase();
  if (normalized.includes("safe")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (normalized.includes("warning")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  if (normalized.includes("critical")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function isDefaultForm(form: SensorForm) {
  return (
    form.methane === initialForm.methane &&
    form.air_quality === initialForm.air_quality &&
    form.temperature === initialForm.temperature &&
    form.humidity === initialForm.humidity
  );
}

function buildTrendValues(history: HistoryItem[], key: keyof Omit<HistoryItem, "ID" | "Risk" | "Anomaly">) {
  return history.map((item) => Number(item[key]));
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) {
    return <div className="h-10 rounded-xl bg-slate-950/60"></div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-12 w-full overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function PlotFrame({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyPlot({ message }: { message: string }) {
  return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">{message}</div>;
}

function SensorPlot({ label, values, color }: { label: string; values: number[]; color: string }) {
  if (values.length === 0) return <EmptyPlot message="Waiting for readings" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${92 - ((value - min) / range) * 78}`).join(" ");

  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-slate-500"><span>{label}</span><span>{max.toFixed(1)}</span></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full rounded-lg bg-slate-900/70 p-2">
        <line x1="0" y1="92" x2="100" y2="92" stroke="#334155" strokeWidth="0.7" />
        <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function H2SRiskPlot({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return <EmptyPlot message="Waiting for H2S history" />;
  const values = history.map((item) => Number(item["Estimated H2S"] ?? 0));
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${94 - (value / max) * 80}`).join(" ");
  const riskColors: Record<string, string> = { Safe: "#34d399", Warning: "#fbbf24", "High Risk": "#fb923c", Critical: "#fb7185" };

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-64 w-full rounded-lg bg-slate-900/70 p-3">
        <line x1="0" y1="94" x2="100" y2="94" stroke="#334155" strokeWidth="0.7" />
        <polyline fill="none" stroke="#22d3ee" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points} vectorEffect="non-scaling-stroke" />
        {values.map((value, index) => (
          <circle key={`${history[index].ID}-h2s`} cx={(index / Math.max(values.length - 1, 1)) * 100} cy={94 - (value / max) * 80} r="1.6" fill={riskColors[history[index].Risk] ?? "#94a3b8"} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
        {Object.entries(riskColors).map(([risk, color]) => <span key={risk} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{risk}</span>)}
      </div>
    </div>
  );
}

function MethaneScatterPlot({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return <EmptyPlot message="Waiting for sensor history" />;
  const maxMethane = Math.max(...history.map((item) => item.Methane), 1);
  const maxAir = Math.max(...history.map((item) => item["Air Quality"]), 1);
  const riskColors: Record<string, string> = { Safe: "#34d399", Warning: "#fbbf24", "High Risk": "#fb923c", Critical: "#fb7185" };

  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-64 w-full rounded-lg bg-slate-900/70 p-3">
        <line x1="8" y1="92" x2="98" y2="92" stroke="#64748b" strokeWidth="0.6" /><line x1="8" y1="92" x2="8" y2="5" stroke="#64748b" strokeWidth="0.6" />
        {history.map((item) => <circle key={`${item.ID}-scatter`} cx={8 + (item.Methane / maxMethane) * 90} cy={92 - (item["Air Quality"] / maxAir) * 87} r="2.2" fill={riskColors[item.Risk] ?? "#22d3ee"} fillOpacity="0.8" stroke="#e2e8f0" strokeWidth="0.35" />)}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>0 methane</span><span>{maxMethane.toFixed(0)} methane</span></div>
    </div>
  );
}

function ShapWaterfall({ explanation }: { explanation: PredictionResponse["shap_explanation"] }) {
  if (!explanation) return <EmptyPlot message="Run a prediction to generate SHAP contributions" />;
  const max = Math.max(...explanation.features.map((feature) => Math.abs(feature.value)), 0.01);
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500">Base value: {explanation.base_value.toFixed(3)}</p>
      {explanation.features.map((feature) => {
        const width = Math.max(5, (Math.abs(feature.value) / max) * 100);
        const positive = feature.value >= 0;
        return (
          <div key={feature.name} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-300">{feature.name}</span>
            <div className="h-5 rounded bg-slate-900"><div className={`h-5 rounded ${positive ? "bg-rose-400/80" : "bg-cyan-400/80"}`} style={{ width: `${width}%` }} /></div>
            <span className={positive ? "text-rose-300" : "text-cyan-300"}>{positive ? "+" : ""}{feature.value.toFixed(3)}</span>
          </div>
        );
      })}
      <div className="flex gap-3 pt-1 text-[10px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-rose-400/80" />raises risk output</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-400/80" />lowers risk output</span></div>
    </div>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [form, setForm] = useState<SensorForm>(initialForm);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [forecastResponse, historyResponse] = await Promise.all([
        fetch("/api/forecast"),
        fetch("/api/history"),
      ]);

      if (!forecastResponse.ok || !historyResponse.ok) {
        throw new Error("The backend service is not reachable right now.");
      }

      const forecastData = await forecastResponse.json();
      const historyData = await historyResponse.json();
      setForecast(forecastData);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load data.");
    }
  };

  useEffect(() => {
    void loadData();

    const interval = window.setInterval(() => {
      void loadData();
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (history.length === 0) return;
    if (!isDefaultForm(form)) return;

    const latest = history[history.length - 1];
    setForm({
      methane: latest.Methane,
      air_quality: latest["Air Quality"],
      temperature: latest.Temperature,
      humidity: latest.Humidity,
    });
  }, [history]);

  const handlePredict = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Prediction request failed.");
      }

      setPrediction(data);
      await loadData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Prediction request failed.");
    } finally {
      setLoading(false);
    }
  };

  const overviewStats = useMemo(() => {
    const counts = history.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.Risk] = (accumulator[item.Risk] ?? 0) + 1;
      return accumulator;
    }, {});

    return [
      { label: "Total Predictions", value: history.length.toString() },
      { label: "Safe", value: counts.Safe?.toString() ?? "0" },
      { label: "Warning", value: counts.Warning?.toString() ?? "0" },
      { label: "High Risk", value: counts["High Risk"]?.toString() ?? "0" },
    ];
  }, [history]);

  const historyAnalytics = useMemo(() => {
    const methane = buildTrendValues(history, "Methane");
    const air_quality = buildTrendValues(history, "Air Quality");
    const temperature = buildTrendValues(history, "Temperature");
    const humidity = buildTrendValues(history, "Humidity");

    const lastTrend = (values: number[]) => {
      if (values.length < 2) return "flat";
      return values[values.length - 1] > values[values.length - 2] ? "up" : values[values.length - 1] < values[values.length - 2] ? "down" : "flat";
    };

    return {
      methane,
      air_quality,
      temperature,
      humidity,
      trend: {
        methane: lastTrend(methane),
        air_quality: lastTrend(air_quality),
        temperature: lastTrend(temperature),
        humidity: lastTrend(humidity),
      },
    };
  }, [history]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(135deg,_#020617,_#0f172a_60%,_#111827)] px-2 py-4 text-slate-100 sm:px-3 lg:px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <aside className="w-full lg:w-64">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Sewer Control</p>
            <h1 className="mt-2 text-xl font-semibold">AI Hazard Command Center</h1>
            <p className="mt-1 text-xs text-slate-400">
              Monitor sensor health, run predictions, review forecasts, and inspect historical events.
            </p>

            <nav className="mt-4 space-y-1.5">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    activeSection === item.id
                      ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-slate-100"
                  }`}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur">
          {activeSection === "overview" && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Live overview</p>
                <h2 className="mt-2 text-2xl font-semibold">Sewer hazard monitoring for rapid response</h2>
                <p className="mt-2 max-w-2xl text-xs text-slate-300">
                  The dashboard combines input data, risk analysis, forecasting and historical review in one place so operators can act quickly.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {overviewStats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-xs text-slate-400">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <h3 className="text-sm font-semibold">Latest prediction</h3>
                  {prediction ? (
                    <div className={`mt-3 rounded-xl border p-3 ${getRiskTone(prediction.risk)}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.25em]">Current status</span>
                        <span className="text-xs font-semibold">{prediction.anomaly}</span>
                      </div>
                      <p className="mt-2 text-xl font-semibold">{prediction.risk}</p>
                      <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/50 p-2 text-xs">
                        <p className="text-slate-400">Estimated H2S</p>
                        <p className="mt-0.5 font-medium">{formatValue(prediction.estimated_h2s ?? 0, " ppm")}</p>
                      </div>
                      <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                        {Object.entries(prediction.explanation).map(([name, value]) => (
                          <div key={name} className="rounded-lg border border-white/10 bg-slate-900/50 p-2">
                            <p className="text-slate-400">{name}</p>
                            <p className="mt-0.5 font-medium">{value.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      Run a new prediction from the Predict view to populate this panel.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <h3 className="text-sm font-semibold">Forecast snapshot</h3>
                  {forecast ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-slate-400">Predicted methane</p>
                        <p className="mt-0.5 text-lg font-semibold">{formatValue(forecast.predicted_methane, " ppm")}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-slate-400">Predicted air quality</p>
                        <p className="mt-0.5 text-lg font-semibold">{formatValue(forecast.predicted_air_quality, " ppm")}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-slate-400">Predicted temperature</p>
                        <p className="mt-0.5 text-lg font-semibold">{formatValue(forecast.predicted_temperature, " °C")}</p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-slate-400">Predicted humidity</p>
                        <p className="mt-0.5 text-lg font-semibold">{formatValue(forecast.predicted_humidity, " %")}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">Forecast values will appear once the API is available.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === "predict" && (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Prediction engine</p>
                <h2 className="mt-2 text-xl font-semibold">Run a new hazard assessment</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Enter the latest sewer sensor measurements and classify the event instantly.
                </p>
              </div>

              <form onSubmit={handlePredict} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:grid-cols-2">
                {[
                  { key: "methane", label: "Methane", suffix: " ppm", step: 1 },
                  { key: "air_quality", label: "Air quality", suffix: " ppm", step: 1 },
                  { key: "temperature", label: "Temperature", suffix: " °C", step: 0.1 },
                  { key: "humidity", label: "Humidity", suffix: " %", step: 0.1 },
                ].map((field) => (
                  <label key={field.key} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                    <span className="mb-1.5 block font-medium">{field.label}</span>
                    <input
                      type="number"
                      step={field.step}
                      value={form[field.key as keyof SensorForm]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none ring-0"
                    />
                    <span className="mt-1 block text-xs text-slate-500">{field.suffix}</span>
                  </label>
                ))}

                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Analyzing..." : "Predict hazard"}
                  </button>
                </div>
              </form>

              {error ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">{error}</p> : null}

              {prediction ? (
                <div className={`rounded-xl border p-4 ${getRiskTone(prediction.risk)}`}>
                  <p className="text-xs uppercase tracking-[0.25em]">Prediction result</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold">{prediction.risk}</p>
                      <p className="mt-0.5 text-xs">Anomaly status: {prediction.anomaly}</p>
                      <p className="mt-1 text-xs">Estimated H2S: {formatValue(prediction.estimated_h2s ?? 0, " ppm")}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs">
                      <p className="text-slate-400">Feature importance</p>
                      <p className="mt-0.5 font-medium">{Object.entries(prediction.explanation).map(([name, value]) => `${name}: ${value}`).join(" • ")}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {activeSection === "forecast" && (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Forecasting</p>
                <h2 className="mt-2 text-xl font-semibold">Next-step environmental outlook</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Use the forecast section to review the expected sensor trend after the latest reading.
                </p>
              </div>

              {forecast ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: "Methane", value: forecast.predicted_methane, suffix: " ppm" },
                    { label: "Air quality", value: forecast.predicted_air_quality, suffix: " ppm" },
                    { label: "Temperature", value: forecast.predicted_temperature, suffix: " °C" },
                    { label: "Humidity", value: forecast.predicted_humidity, suffix: " %" },
                    { label: "H2S", value: forecast.predicted_h2s, suffix: " ppm" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-xs text-slate-400">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{formatValue(item.value, item.suffix)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
                  Forecast data is being loaded from the backend service.
                </p>
              )}
            </section>
          )}

          {activeSection === "history" && (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">History</p>
                <h2 className="mt-2 text-xl font-semibold">Review recent predictions</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Every prediction is stored so operators can review patterns and respond consistently.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Trend analytics</p>
                  <div className="mt-4 space-y-4">
                    {[
                      { label: "Methane", values: historyAnalytics.methane, trend: historyAnalytics.trend.methane, suffix: "ppm", color: "#22d3ee" },
                      { label: "Air quality", values: historyAnalytics.air_quality, trend: historyAnalytics.trend.air_quality, suffix: "ppm", color: "#60a5fa" },
                      { label: "Temperature", values: historyAnalytics.temperature, trend: historyAnalytics.trend.temperature, suffix: "°C", color: "#fde047" },
                      { label: "Humidity", values: historyAnalytics.humidity, trend: historyAnalytics.trend.humidity, suffix: "%", color: "#34d399" },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{metric.label}</span>
                          <span className={
                            metric.trend === "up"
                              ? "text-emerald-300"
                              : metric.trend === "down"
                              ? "text-rose-300"
                              : "text-slate-400"
                          }>
                            {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "—"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-300">Latest</p>
                            <p className="text-xl font-semibold text-white">
                              {history.length > 0 ? formatValue(metric.values[metric.values.length - 1], ` ${metric.suffix}`) : "N/A"}
                            </p>
                          </div>
                          <div className="flex-1">
                            <Sparkline values={metric.values.slice(-12)} color={metric.color} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Class distribution</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {overviewStats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <p className="text-xs text-slate-400">{stat.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {history.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-300">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Methane</th>
                        <th className="px-3 py-2">Air quality</th>
                        <th className="px-3 py-2">Temp</th>
                        <th className="px-3 py-2">Humidity</th>
                        <th className="px-3 py-2">Risk</th>
                        <th className="px-3 py-2">Anomaly</th>
                        <th className="px-3 py-2">Estimated H2S</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60 text-slate-200">
                      {history.map((item) => (
                        <tr key={item.ID}>
                          <td className="px-3 py-2">{item.ID}</td>
                          <td className="px-3 py-2">{item.Methane}</td>
                          <td className="px-3 py-2">{item["Air Quality"]}</td>
                          <td className="px-3 py-2">{item.Temperature}</td>
                          <td className="px-3 py-2">{item.Humidity}</td>
                          <td className="px-3 py-2">{item.Risk}</td>
                          <td className="px-3 py-2">{item.Anomaly}</td>
                          <td className="px-3 py-2">{item["Estimated H2S"] != null ? formatValue(item["Estimated H2S"], " ppm") : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
                  No history is available yet. Submit a prediction to create the first record.
                </p>
              )}
            </section>
          )}

          {activeSection === "visualize" && (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Live analysis</p>
                <h2 className="mt-2 text-xl font-semibold">Visualize Results</h2>
                <p className="mt-1 text-xs text-slate-400">Plots refresh with the latest readings and prediction results.</p>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <PlotFrame title="SHAP waterfall · latest prediction">
                  <ShapWaterfall explanation={prediction?.shap_explanation} />
                </PlotFrame>
                <PlotFrame title="H2S risk trend · history">
                  <H2SRiskPlot history={history.slice(-40)} />
                </PlotFrame>
              </div>

              <PlotFrame title="Sensor readings · four-panel subplot">
                <div className="grid gap-3 md:grid-cols-2">
                  <SensorPlot label="Methane (ppm)" values={history.slice(-40).map((item) => item.Methane)} color="#22d3ee" />
                  <SensorPlot label="Air quality (ppm)" values={history.slice(-40).map((item) => item["Air Quality"])} color="#60a5fa" />
                  <SensorPlot label="Temperature (°C)" values={history.slice(-40).map((item) => item.Temperature)} color="#facc15" />
                  <SensorPlot label="Humidity (%)" values={history.slice(-40).map((item) => item.Humidity)} color="#34d399" />
                </div>
              </PlotFrame>

              <PlotFrame title="Methane vs. air quality · H2S intensity by risk">
                <MethaneScatterPlot history={history.slice(-80)} />
              </PlotFrame>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
